package com.om.To_Do.List.ecosystem.services;

import com.om.To_Do.List.ecosystem.client.UserServiceClient;
import com.om.To_Do.List.ecosystem.dto.*;
import com.om.To_Do.List.ecosystem.model.ListRecipient;
import com.om.To_Do.List.ecosystem.model.ListType;
import com.om.To_Do.List.ecosystem.model.ToDoItem;
import com.om.To_Do.List.ecosystem.model.ToDoList;
import com.om.To_Do.List.ecosystem.repository.ListRecipientRepository;
import com.om.To_Do.List.ecosystem.repository.ToDoItemRepository;
import com.om.To_Do.List.ecosystem.repository.ToDoListRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import java.util.stream.Collectors;

import java.nio.file.AccessDeniedException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
public class ToDoListService {

    @Autowired
    private ToDoListRepository toDoListRepository;
    @Autowired
    private ToDoItemRepository toDoItemRepository;
    @Autowired
    private ListRecipientRepository listRecipientRepository;

    @Autowired
    private ApplicationEventPublisher eventPublisher;

    @Autowired
    private UserServiceClient userServiceClient;

    @Autowired
    // injected via @RequiredArgsConstructor
    private  PaymentService paymentService;

    @Autowired
    private ObjectMapper objectMapper;

    private static final Logger log = LoggerFactory.getLogger(ToDoListService.class);

    private String serializeSubQuantities(List<SubQuantityDTO> subs) {
        if (subs == null) return null;
        try {
            return objectMapper.writeValueAsString(subs);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize sub quantities", e);
        }
    }

    private List<SubQuantityDTO> deserializeSubQuantities(String json) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<List<SubQuantityDTO>>() {});
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to deserialize sub quantities", e);
        }
    }


    // Step 1: Create list without recipients
    @Transactional
    public ToDoList createList(CreateListRequest request) throws AccessDeniedException {
       // 🔒 Require active subscription for this endpoint
       boolean active = paymentService.isSubscriptionActive(request.getCreatedByUserId());
       if (!active) {
           throw new AccessDeniedException(
                   "Subscription required to create priced lists. " +
                           "Use /api/lists/checklist for simple item-only lists.");
       }

        ToDoList list = new ToDoList();
        list.setCreatedByUserId(request.getCreatedByUserId());
        list.setTitle(request.getTitle());
        list.setCreatedAt(LocalDateTime.now());
        list.setListType(ListType.PREMIUM);
        list.setPinned(false);
        toDoListRepository.save(list);

        List<ToDoItem> items = request.getItems().stream().map(dto -> {
            ToDoItem item = new ToDoItem();
            item.setItemName(dto.getItemName());
            item.setQuantity(dto.getQuantity());
            item.setPriceText(dto.getPriceText());
            item.setSubQuantitiesJson(serializeSubQuantities(dto.getSubQuantities()));
            item.setList(list);
            return item;
        }).collect(Collectors.toCollection(ArrayList::new));

        toDoItemRepository.saveAll(items);
        list.setItems(items);
        return list;
    }

    // --- FREE (and also allowed for paid) simple checklists ---
    @Transactional
    public ToDoList createChecklist(CreateChecklistRequest request) {
        ToDoList list = new ToDoList();
        list.setCreatedByUserId(request.getCreatedByUserId());
        list.setTitle(request.getTitle());
        list.setCreatedAt(LocalDateTime.now());
        list.setListType(ListType.BASIC);
        list.setPinned(false);
        toDoListRepository.save(list);

        List<ToDoItem> items = request.getItems().stream().map(dto -> {
            ToDoItem item = new ToDoItem();
            item.setItemName(dto.getItemName());
            // force simple fields
            item.setQuantity(null);
            item.setPriceText(null);
            item.setSubQuantitiesJson(null);
            item.setList(list);
            return item;
       }).collect(Collectors.toCollection(ArrayList::new));

        toDoItemRepository.saveAll(items);
        list.setItems(items);
        return list;
    }

    // Step 2: Add recipients
    @Transactional
    public void addRecipientsByPhone(Long listId, List<String> phoneNumbers) throws IllegalAccessException {
        if(phoneNumbers == null || phoneNumbers.isEmpty()){
            throw new IllegalAccessException("phoneNumbers must not be null or empty.");
        }

        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        // Fetch matching user IDs from Authentication Service
        List<Long> userIds = userServiceClient
                .getUserIdsByPhoneNumbers(phoneNumbers)
                .getBody();
        if (userIds == null || userIds.isEmpty()) {
            throw new RuntimeException("No users found for given phone numbers");
        }

        Long creatorUserId = list.getCreatedByUserId();

        // Filter out self
        userIds = userIds.stream()
                .filter(id -> !id.equals(creatorUserId))
                .toList();

        if (userIds.isEmpty()) return;

        // Fetch existing recipients to avoid duplicates
        List<Long> existingRecipientIds = listRecipientRepository
                .findByListId(listId).stream()
                .map(ListRecipient::getRecipientUserId)
                .toList();

        // Build new recipient entities
        List<ListRecipient> newRecipients = userIds.stream()
                .filter(id -> !existingRecipientIds.contains(id))
                .map(id -> {
                    ListRecipient r = new ListRecipient();
                    r.setList(list);
                    r.setRecipientUserId(id);
                    return r;
                })
                .toList();

        if (newRecipients.isEmpty()) return;

        // 1) Persist all new recipients
        listRecipientRepository.saveAll(newRecipients);

        // 2) Publish the event for downstream Notification-Service
        List<Long> newUserIds = newRecipients.stream()
                .map(ListRecipient::getRecipientUserId)
                .toList();

        RecipientAddedEvent evt = new RecipientAddedEvent(
                listId,
                list.getTitle(),
                creatorUserId,
                newUserIds
        );
        eventPublisher.publishEvent(evt);
    }

    @Transactional
    public ToDoItemRes addItemToPremiumList(Long listId, Long userId, CreateItemRequest request) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));
        boolean active = paymentService.isSubscriptionActive(list.getCreatedByUserId());
       if (!active) {
           throw new AccessDeniedException(
                   "Subscription required to create priced lists. " +
                           "Use /api/lists/checklist for simple item-only lists.");
       }

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can update this list.");
        }

        if (list.getListType() != ListType.PREMIUM) {
            throw new RuntimeException("This endpoint is only available for premium lists");
        }

        if (request.getItemName() == null || request.getItemName().isBlank()) {
            throw new IllegalArgumentException("Item name must be provided");
        }

        ToDoItem item = new ToDoItem();
        item.setItemName(request.getItemName());
        item.setQuantity(request.getQuantity());
        item.setPriceText(request.getPriceText());
        item.setSubQuantitiesJson(serializeSubQuantities(request.getSubQuantities()));
        item.setList(list);

        ToDoItem saved = toDoItemRepository.save(item);
        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);

        ToDoItemRes response = new ToDoItemRes();
        response.setId(saved.getId());
        response.setItemName(saved.getItemName());
        response.setQuantity(saved.getQuantity());
        response.setPriceText(saved.getPriceText());
        response.setCreatedAt(saved.getCreatedAt());
        response.setUpdatedAt(saved.getUpdatedAt());
        response.setSubQuantitiesJson(saved.getSubQuantitiesJson());

        return response;
    }

    @Transactional
    public ToDoItemRes addItemToChecklist(Long listId, Long userId, CreateChecklistItemRequest request) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can update this list.");
        }

        if (list.getListType() != ListType.BASIC) {
            throw new RuntimeException("This endpoint is only available for basic checklists");
        }

        if (request.getItemName() == null || request.getItemName().isBlank()) {
            throw new IllegalArgumentException("Item name must be provided");
        }

        ToDoItem item = new ToDoItem();
        item.setItemName(request.getItemName());
        item.setQuantity(null);
        item.setPriceText(null);
        item.setSubQuantitiesJson(null);
        item.setList(list);

        ToDoItem saved = toDoItemRepository.save(item);
        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);

        ToDoItemRes response = new ToDoItemRes();
        response.setId(saved.getId());
        response.setItemName(saved.getItemName());
        response.setQuantity(saved.getQuantity());
        response.setPriceText(saved.getPriceText());
        response.setCreatedAt(saved.getCreatedAt());
        response.setUpdatedAt(saved.getUpdatedAt());
        response.setSubQuantitiesJson(saved.getSubQuantitiesJson());

        return response;
    }


    public void removeRecipientFromList(Long listId, Long recipientUserId) {
        ListRecipient recipient = listRecipientRepository.findByListIdAndRecipientUserId(listId, recipientUserId)
                .orElseThrow(() -> new RuntimeException("You are not a recipient of this list"));

        listRecipientRepository.delete(recipient);
    }


    public void deleteList(Long listId, Long userId) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can delete this list.");
        }
        List<Long> recipientIds = listRecipientRepository.findByListId(listId).stream()
                .map(ListRecipient::getRecipientUserId)
                .toList();

        if (!recipientIds.isEmpty()) {
            ListDeletedEvent evt = new ListDeletedEvent(
                    listId,
                    list.getTitle(),
                    userId,
                    recipientIds
            );
            eventPublisher.publishEvent(evt);
        }
        toDoListRepository.delete(list);
    }

    public List<ToDoListTitleDTO> getListsByCreator(Long userId) {
         List<ToDoList> lists = toDoListRepository.findByCreatedByUserIdOrderByPinnedDescUpdatedAtDesc(userId);

        log.info("ToDoList: {}", lists);

        return lists.stream().map(list -> {
            ToDoListTitleDTO dto = new ToDoListTitleDTO();
            dto.setId(list.getId());
            dto.setTitle(list.getTitle());
            dto.setPinned(list.isPinned());
            return dto;
        }).toList();
    }

     public void updatePinStatus(Long listId, Long userId, boolean pinned) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can update this list.");
        }

        list.setPinned(pinned);
        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);
    }
    
    public ToDoListSummaryDTO getListByIdAndCreator(Long listId, String phoneNumber) {
        Long userId = userServiceClient.getUseridByPhoneNumber(phoneNumber).getBody();
        ToDoList list = toDoListRepository.findByIdAndCreatedByUserId(listId, userId)
                .orElseThrow(() -> new RuntimeException("List not found or you are not the owner"));

        ToDoListSummaryDTO dto = new ToDoListSummaryDTO();
        dto.setId(list.getId());
        dto.setTitle(list.getTitle());
        dto.setListType(list.getListType().name());
        dto.setCreatedAt(list.getCreatedAt());
        dto.setUpdatedAt(list.getUpdatedAt());
        dto.setCreatedByUserId(list.getCreatedByUserId());

        List<ToDoItem> items = toDoItemRepository.findByListId(list.getId());
        if (items == null) {
            items = Collections.emptyList();
        }

        List<ToDoItemRes> itemDTOs = items.stream().map(item -> {
            ToDoItemRes itemDTO = new ToDoItemRes();
            itemDTO.setId(item.getId());
            itemDTO.setItemName(item.getItemName());
            itemDTO.setQuantity(item.getQuantity());
            itemDTO.setPriceText(item.getPriceText());
            itemDTO.setCreatedAt(item.getCreatedAt());
            itemDTO.setUpdatedAt(item.getUpdatedAt());
            itemDTO.setSubQuantitiesJson(item.getSubQuantitiesJson());
            return itemDTO;
        }).toList();

        dto.setItems(itemDTOs);
        return dto;
    }

    public List<ToDoListTitleDTO> getSharedListTitles(Long currentUserId, String phoneNumber) {
        Long peerId = userServiceClient.getUseridByPhoneNumber(phoneNumber).getBody();
        List<ToDoList> lists = listRecipientRepository.findListsSharedBetween(currentUserId, peerId);

        return lists.stream().map(list -> {
            ToDoListTitleDTO dto = new ToDoListTitleDTO();
            dto.setId(list.getId());
            dto.setTitle(list.getTitle());
            return dto;
        }).toList();
    }

    public ToDoListSummaryDTO getSharedList(Long listId, Long currentUserId, String phoneNumber) {
        Long peerId = userServiceClient.getUseridByPhoneNumber(phoneNumber).getBody();
        ToDoList list = listRecipientRepository.findSharedListBetweenUsers(listId, currentUserId, peerId)
                .orElseThrow(() -> new RuntimeException("List not found or not shared with this user"));

        ToDoListSummaryDTO dto = new ToDoListSummaryDTO();
        dto.setTitle(list.getTitle());
        dto.setCreatedByUserId(list.getCreatedByUserId());
        dto.setId(list.getId());
        dto.setListType(list.getListType().name());
        dto.setUpdatedAt(list.getUpdatedAt());
        dto.setCreatedAt(list.getCreatedAt());
        List<ToDoItem> items = toDoItemRepository.findByListId(list.getId());
        if (items == null) {
            items = Collections.emptyList();
        }

        List<ToDoItemRes> itemDTOs = items.stream().map(item -> {
            ToDoItemRes itemDTO = new ToDoItemRes();
            itemDTO.setId(item.getId());
            itemDTO.setUpdatedAt(item.getUpdatedAt());
            itemDTO.setCreatedAt(item.getCreatedAt());
            itemDTO.setItemName(item.getItemName());
            itemDTO.setQuantity(item.getQuantity());
            itemDTO.setPriceText(item.getPriceText());
            itemDTO.setSubQuantitiesJson(item.getSubQuantitiesJson());
            return itemDTO;
        }).toList();

        dto.setItems(itemDTOs);
        return dto;
    }

    public ListRecipientsDTO getRecipientsForList(Long listId, Long creatorId) {
        ToDoList list = toDoListRepository.findByIdAndCreatedByUserId(listId, creatorId)
                .orElseThrow(() -> new RuntimeException("List not found or unauthorized"));

        List<Long> recipientIds = listRecipientRepository.findRecipientIdsByListIdAndCreatorId(listId, creatorId);

        ListRecipientsDTO dto = new ListRecipientsDTO();
        dto.setListId(list.getId());
        dto.setTitle(list.getTitle());
        dto.setRecipientUserIds(recipientIds);

        return dto;
    }

    public void deleteRecipientByPhone(Long listId, String phoneNumber, Long creatorId) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findByIdAndCreatedByUserId(listId, creatorId)
                .orElseThrow(() -> new RuntimeException("List not found or unauthorized"));

        Long userId = userServiceClient.getUseridByPhoneNumber(phoneNumber).getBody();

        if (!list.getCreatedByUserId().equals(creatorId)) {
            throw new AccessDeniedException("Only the meeting creator can update this meeting.");
        }
        if (userId == null) {
            throw new RuntimeException("No user found with this phone number");
        }

        Long userIdToDelete = userId;

        ListRecipient recipient = listRecipientRepository
                .findByListIdAndRecipientUserId(listId, userIdToDelete)
                .orElseThrow(() -> new RuntimeException("User is not a recipient of this list"));

        listRecipientRepository.delete(recipient);

        RecipientsRemovedFromListEvent evt = new RecipientsRemovedFromListEvent(
                listId,
                list.getTitle(),
                userId,
                creatorId
        );
        eventPublisher.publishEvent(evt);
    }

    public ToDoItemRes updateItem(Long listId, Long itemId, Long userId, UpdateItemRequest req) throws AccessDeniedException {

        // 1) verify list exists
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));
       boolean active = paymentService.isSubscriptionActive(list.getCreatedByUserId());
       if (!active) {
           throw new AccessDeniedException(
                   "Subscription required to create priced lists. " +
                           "Use /api/lists/checklist for simple item-only lists.");
       }
        // 2) load the item
        ToDoItem item = toDoItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        // 3) ensure it belongs to the right list
        if (!item.getList().getId().equals(listId)) {
            throw new RuntimeException("Item does not belong to list " + listId);
        }

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the meeting creator can update this meeting.");
        }

        // 4) apply updates if provided
        if (req.getItemName() != null)       item.setItemName(req.getItemName());
        if (req.getQuantity() != null)       item.setQuantity(req.getQuantity());
        if (req.getPriceText() != null)      item.setPriceText(req.getPriceText());
        if (req.getSubQuantities() != null) {
            item.setSubQuantitiesJson(serializeSubQuantities(req.getSubQuantities()));
        }
        toDoItemRepository.save(item);
        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);

        ToDoItemRes toDoItemDTO = new ToDoItemRes();
        toDoItemDTO.setId(item.getId());
        toDoItemDTO.setItemName(item.getItemName());
        toDoItemDTO.setId(item.getId());
        toDoItemDTO.setUpdatedAt(item.getUpdatedAt());
        toDoItemDTO.setPriceText(item.getPriceText());
        toDoItemDTO.setQuantity(item.getQuantity());
        toDoItemDTO.setCreatedAt(item.getCreatedAt());
        toDoItemDTO.setSubQuantitiesJson(item.getSubQuantitiesJson());

        // 5) persist and return
        return toDoItemDTO;
    }

    /**
     * Delete a single ToDoItem from a list.
     */
    public void deleteItem(Long listId, Long itemId, Long userId) throws AccessDeniedException {

        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));
       boolean active = paymentService.isSubscriptionActive(list.getCreatedByUserId());
       if (!active) {
           throw new AccessDeniedException(
                   "Subscription required to create priced lists. " +
                           "Use /api/lists/checklist for simple item-only lists.");
       }

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the meeting creator can update this meeting.");
        }

        ToDoItem item = toDoItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        if (!item.getList().getId().equals(listId)) {
            throw new RuntimeException("Item does not belong to list " + listId);
        }

        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);

        toDoItemRepository.delete(item);
    }

    @Transactional
    public ToDoItemRes updateChecklistItem(Long listId, Long itemId, Long userId, UpdateChecklistItemRequest req)
            throws AccessDeniedException {

        // 1) verify list exists
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        // 2) only creator can update
        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can update this list.");
        }

        // 3) load item & ensure it belongs
        ToDoItem item = toDoItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        if (!item.getList().getId().equals(listId)) {
            throw new RuntimeException("Item does not belong to list " + listId);
        }

        // 4) apply checklist-only fields
        if (req.getItemName() != null) item.setItemName(req.getItemName());

        // Hard-enforce checklist shape (strip any priced fields if they existed)
        item.setQuantity(null);
        item.setPriceText(null);
        item.setSubQuantitiesJson(null);

        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);
        ToDoItem saved = toDoItemRepository.save(item);

        ToDoItemRes response = new ToDoItemRes();
        response.setId(saved.getId());
        response.setItemName(saved.getItemName());
        response.setQuantity(saved.getQuantity());
        response.setPriceText(saved.getPriceText());
        response.setCreatedAt(saved.getCreatedAt());
        response.setUpdatedAt(saved.getUpdatedAt());
        response.setSubQuantitiesJson(saved.getSubQuantitiesJson());

        return response;
    }

    // ✅ CHECKLIST: Delete (no subscription check)
    @Transactional
    public void deleteChecklistItem(Long listId, Long itemId, Long userId) throws AccessDeniedException {

        // 1) verify list exists
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        // 2) only creator can delete
        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the list creator can update this list.");
        }

        // 3) load item & ensure it belongs
        ToDoItem item = toDoItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));
        if (!item.getList().getId().equals(listId)) {
            throw new RuntimeException("Item does not belong to list " + listId);
        }

        list.setUpdatedAt(LocalDateTime.now());
        toDoListRepository.save(list);
        // 4) delete
        toDoItemRepository.delete(item);
    }

    public List<ToDoItem> getUpdatesSince(Long listId, LocalDateTime since) {
        return toDoItemRepository.findByListIdAndUpdatedAtAfter(listId, since);
    }

    @Transactional
    public SyncResponse syncOfflineUpdates(Long listId, SyncRequest request) {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));

        List<ToDoItem> updatedItems = new ArrayList<>();
        List<SyncConflictDTO> conflicts = new ArrayList<>();

        for (SyncItemDTO dto : request.getItems()) {
            String action = dto.getAction();
            if ("CREATE".equalsIgnoreCase(action)) {
                ToDoItem item = new ToDoItem();
                item.setItemName(dto.getItemName());
                item.setQuantity(dto.getQuantity());
                item.setPriceText(dto.getPriceText());
                item.setSubQuantitiesJson(dto.getSubQuantitiesJson());
                item.setList(list);
                updatedItems.add(toDoItemRepository.save(item));
            } else if ("UPDATE".equalsIgnoreCase(action)) {
                ToDoItem existing = toDoItemRepository.findById(dto.getId()).orElse(null);
                if (existing == null) {
                    conflicts.add(new SyncConflictDTO(dto.getId(), "Item not found"));
                } else if (dto.getUpdatedAt() != null && existing.getUpdatedAt() != null
                        && existing.getUpdatedAt().isAfter(dto.getUpdatedAt())) {
                    conflicts.add(new SyncConflictDTO(dto.getId(), "Item modified on server"));
                } else {
                    existing.setItemName(dto.getItemName());
                    existing.setQuantity(dto.getQuantity());
                    existing.setPriceText(dto.getPriceText());
                    existing.setSubQuantitiesJson(dto.getSubQuantitiesJson());
                    updatedItems.add(toDoItemRepository.save(existing));
                }
            } else if ("DELETE".equalsIgnoreCase(action)) {
                ToDoItem existing = toDoItemRepository.findById(dto.getId()).orElse(null);
                if (existing == null) {
                    conflicts.add(new SyncConflictDTO(dto.getId(), "Item already deleted"));
                } else {
                    toDoItemRepository.delete(existing);
                }
            }
        }

        return new SyncResponse(updatedItems, conflicts);
    }

    public ToDoList updateListName(Long listId, Long userId, String newName) throws AccessDeniedException {
        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));
        if (newName != null && !newName.isBlank() && !newName.equals(list.getTitle())) {
            String oldName = list.getTitle();
            list.setTitle(newName);
            toDoListRepository.save(list);

            List<Long> recipientIds = listRecipientRepository.findByListId(listId).stream()
                    .map(ListRecipient::getRecipientUserId)
                    .toList();

            if (!recipientIds.isEmpty()) {
                ListNameChangedEvent evt = new ListNameChangedEvent(
                        listId,
                        oldName,
                        newName,
                        userId,
                        recipientIds
                );
                eventPublisher.publishEvent(evt);
            }
        }
        return list;
    }


    public ToDoItemRes getItem(Long listId, Long itemId, Long userId) throws AccessDeniedException {

        ToDoList list = toDoListRepository.findById(listId)
                .orElseThrow(() -> new RuntimeException("List not found"));
       boolean active = paymentService.isSubscriptionActive(list.getCreatedByUserId());
       if (!active) {
           throw new AccessDeniedException(
                   "Subscription required to create priced lists. " +
                           "Use /api/lists/checklist for simple item-only lists.");
       }
        // 2) load the item
        ToDoItem item = toDoItemRepository.findById(itemId)
                .orElseThrow(() -> new RuntimeException("Item not found"));

        // 3) ensure it belongs to the right list
        if (!item.getList().getId().equals(listId)) {
            throw new RuntimeException("Item does not belong to list " + listId);
        }

        if (!list.getCreatedByUserId().equals(userId)) {
            throw new AccessDeniedException("Only the creator can update this meeting.");
        }


        ToDoItemRes toDoItemDTO = new ToDoItemRes();
        toDoItemDTO.setId(item.getId());
        toDoItemDTO.setItemName(item.getItemName());
        toDoItemDTO.setId(item.getId());
        toDoItemDTO.setUpdatedAt(item.getUpdatedAt());
        toDoItemDTO.setPriceText(item.getPriceText());
        toDoItemDTO.setQuantity(item.getQuantity());
        toDoItemDTO.setCreatedAt(item.getCreatedAt());
        toDoItemDTO.setSubQuantitiesJson(item.getSubQuantitiesJson());

        // 5) persist and return
        return toDoItemDTO;
    }
}

package com.om.To_Do.List.ecosystem.controller;


import com.om.To_Do.List.ecosystem.dto.*;
import com.om.To_Do.List.ecosystem.model.ToDoItem;
import com.om.To_Do.List.ecosystem.services.ToDoListService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;

import java.nio.file.AccessDeniedException;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/lists")
@RequiredArgsConstructor
@CrossOrigin(origins = "${cors.allowed-origins}")
public class ToDoListController {

    @Autowired
    private  ToDoListService toDoListService;

    // Step 1: Create list without recipients
    @PostMapping
    public ResponseEntity<?> createList(@RequestBody CreateListRequest request) throws AccessDeniedException {
        return ResponseEntity.ok(toDoListService.createList(request));
    }

    // Step 2: Add recipients later
    @PostMapping("/{listId}/recipients")
    public ResponseEntity<?> addRecipients(@PathVariable Long listId, @RequestBody AddRecipientsByPhoneRequest request) throws IllegalAccessException {
        if(request.getPhoneNumbers() == null || request.getPhoneNumbers().isEmpty()){
            throw new IllegalAccessException("phoneNumbers must not be null or empty.");
        }
        toDoListService.addRecipientsByPhone(listId, request.getPhoneNumbers());
        return ResponseEntity.ok("Recipients added successfully.");
    }

    @DeleteMapping("/{listId}/recipients-by-phone")
    public ResponseEntity<?> deleteRecipientByPhone(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody String phoneNumber) throws AccessDeniedException {

        toDoListService.deleteRecipientByPhone(listId, phoneNumber.trim().replace("\"", ""), Long.valueOf(userId));
        return ResponseEntity.ok("Recipient removed successfully.");
    }

    @PostMapping("/checklist")
    public ResponseEntity<?> createChecklist(@RequestBody CreateChecklistRequest request) {
        return ResponseEntity.ok(toDoListService.createChecklist(request));
    }

    @DeleteMapping("/{listId}/leave")
    public ResponseEntity<?> leaveSharedList(@PathVariable Long listId, @RequestBody LeaveListRequest request) {
        toDoListService.removeRecipientFromList(listId, request.getRecipientUserId());
        return ResponseEntity.ok("You have left the list.");
    }

    @PutMapping("/{listId}/name")
    public ResponseEntity<?> updateListName(@PathVariable Long listId,
                                            @RequestHeader("X-User-Id") String userId,
                                            @RequestBody UpdateListNameRequest request) throws AccessDeniedException {
        return ResponseEntity.ok(
                toDoListService.updateListName(listId, Long.valueOf(userId), request.getNewName()));
    }

    @DeleteMapping("/{listId}")
    public ResponseEntity<?> deleteList(@PathVariable Long listId, @RequestHeader("X-User-Id") String userId ) throws AccessDeniedException {
        toDoListService.deleteList(listId, Long.valueOf(userId));
        return ResponseEntity.ok("List deleted successfully.");
    }

    @GetMapping("/created")
    public ResponseEntity<List<ToDoListTitleDTO>> getListsByUser(@RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(toDoListService.getListsByCreator(Long.valueOf(userId)));
    }

     @PutMapping("/{listId}/pin")
    public ResponseEntity<Void> updatePinStatus(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody PinListRequest request
    ) throws AccessDeniedException {
        toDoListService.updatePinStatus(listId, Long.valueOf(userId), request.isPinned());
        return ResponseEntity.ok().build();
    }

    @GetMapping("/{listId}/creator/{phoneNumber}")
    public ResponseEntity<ToDoListSummaryDTO> getListByIdAndCreator(
            @PathVariable Long listId,
            @PathVariable String phoneNumber) {

        return ResponseEntity.ok(toDoListService.getListByIdAndCreator(listId, phoneNumber));
    }

    @GetMapping("/shared")
    public ResponseEntity<List<ToDoListTitleDTO>> getSharedLists(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam String phoneNumber) {

        return ResponseEntity.ok(toDoListService.getSharedListTitles(Long.valueOf(userId), phoneNumber));
    }

    @GetMapping("/{listId}/shared")
    public ResponseEntity<ToDoListSummaryDTO> getSharedList(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId,
            @RequestParam String phoneNumber) {

        return ResponseEntity.ok(toDoListService.getSharedList(listId, Long.valueOf(userId), phoneNumber));
    }

    @GetMapping("/{listId}/recipients")
    public ResponseEntity<ListRecipientsDTO> getRecipientsForList(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId) {
        return ResponseEntity.ok(toDoListService.getRecipientsForList(listId, Long.valueOf(userId)));
    }

     @PostMapping("/{listId}/items")
    public ResponseEntity<ToDoItemRes> addItem(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody CreateItemRequest request
    ) throws AccessDeniedException {
        ToDoItemRes created = toDoListService.addItemToPremiumList(listId, Long.valueOf(userId), request);
        return ResponseEntity.ok(created);
    }

    @PostMapping("/{listId}/checklist/items")
    public ResponseEntity<ToDoItemRes> addChecklistItem(
            @PathVariable Long listId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody CreateChecklistItemRequest request
    ) throws AccessDeniedException {
        ToDoItemRes created = toDoListService.addItemToChecklist(listId, Long.valueOf(userId), request);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{listId}/items/{itemId}")
    public ResponseEntity<ToDoItemRes> updateItem(
            @PathVariable Long listId,
            @PathVariable Long itemId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody UpdateItemRequest request
    ) throws AccessDeniedException {
        ToDoItemRes updated = toDoListService.updateItem(listId, itemId, Long.valueOf(userId), request);
        return ResponseEntity.ok(updated);
    }
    @GetMapping("/{listId}/items/{itemId}")
    public ResponseEntity<ToDoItemRes> getItem( @PathVariable Long listId,
                                                @PathVariable Long itemId,
                                                @RequestHeader("X-User-Id") String userId) throws AccessDeniedException {
        ToDoItemRes toDoItemRes = toDoListService.getItem(listId, itemId, Long.valueOf(userId));
        return ResponseEntity.ok(toDoItemRes);
    }

    /**
     * Delete one item from a list.
     */
    @DeleteMapping("/{listId}/items/{itemId}")
    public ResponseEntity<Void> deleteItem(
            @PathVariable Long listId,
            @PathVariable Long itemId,
            @RequestHeader("X-User-Id") String userId
    ) throws AccessDeniedException {
        toDoListService.deleteItem(listId, itemId, Long.valueOf(userId));
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{listId}/checklist/items/{itemId}")
    public ResponseEntity<ToDoItemRes> updateChecklistItem(
            @PathVariable Long listId,
            @PathVariable Long itemId,
            @RequestHeader("X-User-Id") String userId,
            @RequestBody UpdateChecklistItemRequest request
    ) throws java.nio.file.AccessDeniedException {
        ToDoItemRes updated = toDoListService.updateChecklistItem(listId, itemId, Long.valueOf(userId), request);
        return ResponseEntity.ok(updated);
    }

    // ✅ CHECKLIST: Delete one item (no subscription check)
    @DeleteMapping("/{listId}/checklist/items/{itemId}")
    public ResponseEntity<Void> deleteChecklistItem(
            @PathVariable Long listId,
            @PathVariable Long itemId,
            @RequestHeader("X-User-Id") String userId
    ) throws java.nio.file.AccessDeniedException {
        toDoListService.deleteChecklistItem(listId, itemId, Long.valueOf(userId));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{listId}/sync")
    public ResponseEntity<List<ToDoItem>> getUpdatesSince(
            @PathVariable Long listId,
            @RequestParam("since") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime since
    ) {
        return ResponseEntity.ok(toDoListService.getUpdatesSince(listId, since));
    }

    @PostMapping("/{listId}/sync")
    public ResponseEntity<SyncResponse> syncOfflineUpdates(
            @PathVariable Long listId,
            @RequestBody SyncRequest request
    ) {
        return ResponseEntity.ok(toDoListService.syncOfflineUpdates(listId, request));
    }



}

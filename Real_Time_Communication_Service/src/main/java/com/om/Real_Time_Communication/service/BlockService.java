package com.om.Real_Time_Communication.service;

import com.om.Real_Time_Communication.Repository.UserBlockRepository;
import com.om.Real_Time_Communication.models.BlockStatus;
import com.om.Real_Time_Communication.models.UserBlock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class BlockService {

    @Autowired
    private UserBlockRepository blockRepo;

    public boolean isBlocked(String senderId, String receiverId) {
        List<UserBlock> block = blockRepo.findActiveBlockBetween(senderId, receiverId);
        return !block.isEmpty(); // If any active block exists → blocked
    }

    public void blockUser(String blockerId, String blockedId) {
        Optional<UserBlock> existing = blockRepo.findByBlockerIdAndBlockedId(blockerId, blockedId);

        if (existing.isPresent()) {
            UserBlock userBlock = existing.get();
            userBlock.setStatus(BlockStatus.BLOCKED);
        } else {
            UserBlock userBlock = new UserBlock();
            userBlock.setBlockerId(blockerId);
            userBlock.setBlockedId(blockedId);
            userBlock.setStatus(BlockStatus.BLOCKED);
            blockRepo.save(userBlock);
        }
    }

    public void unblockUser(String blockerId, String blockedId) {
        blockRepo.findByBlockerIdAndBlockedId(blockerId, blockedId).ifPresent(block -> {
            block.setStatus(BlockStatus.UNBLOCKED);
            blockRepo.save(block);
        });
    }

}

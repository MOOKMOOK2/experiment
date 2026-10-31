package com.roomexperiment.dto;

import com.roomexperiment.domain.RoomCode;

import java.util.UUID;

public record CompleteExplorationResponse(
        UUID experimentId,
        RoomCode roomCode,
        long explorationMillis
) {
}

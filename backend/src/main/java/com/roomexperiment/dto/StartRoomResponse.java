package com.roomexperiment.dto;

import com.roomexperiment.domain.RoomCode;

import java.util.UUID;

public record StartRoomResponse(
        UUID experimentId,
        RoomCode roomCode
) {
}

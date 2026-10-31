package com.roomexperiment.dto;

import com.roomexperiment.domain.RoomCode;
import com.roomexperiment.domain.ViewMode;

import java.time.Instant;
import java.util.UUID;

public record RoomSurveyResponse(
        UUID experimentId,
        RoomCode roomCode,
        ViewMode viewMode,
        long explorationMillis,
        double convenienceScore,
        double choiceConfidenceScore,
        Instant submittedAt,
        int spaceAccuracy,
        int savedAnswerCount
) {
}

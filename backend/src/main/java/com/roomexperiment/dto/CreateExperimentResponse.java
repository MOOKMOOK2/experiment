package com.roomexperiment.dto;

import java.util.UUID;

public record CreateExperimentResponse(
        UUID experimentId,
        String participantCode
) {
}

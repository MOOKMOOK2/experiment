package com.roomexperiment.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record CompleteExplorationRequest(
        @NotNull @PositiveOrZero Long explorationMillis
) {
}

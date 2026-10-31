package com.roomexperiment.dto;

import com.roomexperiment.domain.ViewMode;
import jakarta.validation.constraints.NotNull;

public record StartRoomRequest(
        @NotNull ViewMode viewMode
) {
}

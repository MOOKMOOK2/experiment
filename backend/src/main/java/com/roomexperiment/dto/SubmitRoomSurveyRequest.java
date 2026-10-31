package com.roomexperiment.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public record SubmitRoomSurveyRequest(
        @NotEmpty Map<@NotBlank String, @NotBlank String> answers
) {
}

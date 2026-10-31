package com.roomexperiment.controller;

import com.roomexperiment.domain.RoomCode;
import com.roomexperiment.dto.CompleteExplorationRequest;
import com.roomexperiment.dto.CompleteExplorationResponse;
import com.roomexperiment.dto.CreateExperimentResponse;
import com.roomexperiment.dto.RoomSurveyResponse;
import com.roomexperiment.dto.StartRoomRequest;
import com.roomexperiment.dto.StartRoomResponse;
import com.roomexperiment.dto.SubmitRoomSurveyRequest;
import com.roomexperiment.service.ExperimentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/experiments")
public class ExperimentController {

    private final ExperimentService experimentService;

    public ExperimentController(ExperimentService experimentService) {
        this.experimentService = experimentService;
    }

    @PostMapping
    public ResponseEntity<CreateExperimentResponse> startExperiment() {
        return ResponseEntity.ok(experimentService.startExperiment());
    }

    @PostMapping("/{experimentId}/rooms/{roomCode}/start")
    public ResponseEntity<StartRoomResponse> startRoom(
            @PathVariable UUID experimentId,
            @PathVariable RoomCode roomCode,
            @Valid @RequestBody StartRoomRequest request
    ) {
        return ResponseEntity.ok(
                experimentService.startRoom(experimentId, roomCode, request.viewMode())
        );
    }

    @PostMapping("/{experimentId}/rooms/{roomCode}/exploration-complete")
    public ResponseEntity<CompleteExplorationResponse> completeExploration(
            @PathVariable UUID experimentId,
            @PathVariable RoomCode roomCode,
            @Valid @RequestBody CompleteExplorationRequest request
    ) {
        return ResponseEntity.ok(experimentService.completeExploration(
                experimentId,
                roomCode,
                request.explorationMillis()
        ));
    }

    @PostMapping("/{experimentId}/rooms/{roomCode}/submit")
    public ResponseEntity<RoomSurveyResponse> submitRoomSurvey(
            @PathVariable UUID experimentId,
            @PathVariable RoomCode roomCode,
            @Valid @RequestBody SubmitRoomSurveyRequest request
    ) {
        return ResponseEntity.ok(
                experimentService.submitRoomSurvey(experimentId, roomCode, request.answers())
        );
    }
}

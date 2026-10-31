package com.roomexperiment.repository;

import com.roomexperiment.domain.RoomCode;
import com.roomexperiment.entity.RoomSurvey;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RoomSurveyRepository extends JpaRepository<RoomSurvey, UUID> {

    Optional<RoomSurvey> findByExperimentSession_IdAndRoomCode(UUID experimentId, RoomCode roomCode);
}

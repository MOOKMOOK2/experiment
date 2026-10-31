package com.roomexperiment.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "experiment_sessions")
public class ExperimentSession {
    public ExperimentSession(String participantCode, Instant createdAt) {
        this.participantCode = participantCode;
        this.createdAt = createdAt;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String participantCode;

    @Column(nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "experimentSession", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RoomSurvey> roomSurveys = new ArrayList<>();

    protected ExperimentSession() {
    }

    public UUID getId() {
        return id;
    }

    public String getParticipantCode() {
        return participantCode;
    }

    public void setParticipantCode(String participantCode) {
        this.participantCode = participantCode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public List<RoomSurvey> getRoomSurveys() {
        return roomSurveys;
    }

    public void addRoomSurvey(RoomSurvey roomSurvey) {
        roomSurveys.add(roomSurvey);
        roomSurvey.setExperimentSession(this);
    }
}

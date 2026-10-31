package com.roomexperiment.entity;

import com.roomexperiment.domain.RoomCode;
import com.roomexperiment.domain.ViewMode;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "room_surveys",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_session_room",
                columnNames = {"experiment_session_id", "room_code"}
        )
)
public class RoomSurvey {
    public RoomSurvey(RoomCode roomCode, ViewMode viewMode) {
        this.roomCode = roomCode;
        this.viewMode = viewMode;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "experiment_session_id", nullable = false)
    private ExperimentSession experimentSession;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RoomCode roomCode;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ViewMode viewMode;

    private Long explorationMillis;

    @Column(name = "convenience_score")
    private Double convenienceScore;

    @Column(name = "choice_confidence_score")
    private Double choiceConfidenceScore;

    @Column(name = "space_accuracy")
    private Integer spaceAccuracy;

    private Instant submittedAt;

    @OneToMany(mappedBy = "roomSurvey", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SurveyAnswer> answers = new ArrayList<>();

    protected RoomSurvey() {
    }

    public UUID getId() {
        return id;
    }

    public ExperimentSession getExperimentSession() {
        return experimentSession;
    }

    public void setExperimentSession(ExperimentSession experimentSession) {
        this.experimentSession = experimentSession;
    }

    public RoomCode getRoomCode() {
        return roomCode;
    }

    public void setRoomCode(RoomCode roomCode) {
        this.roomCode = roomCode;
    }

    public ViewMode getViewMode() {
        return viewMode;
    }

    public void setViewMode(ViewMode viewMode) {
        this.viewMode = viewMode;
    }

    public Long getExplorationMillis() {
        return explorationMillis;
    }

    public void setExplorationMillis(Long explorationMillis) {
        this.explorationMillis = explorationMillis;
    }

    public Double getConvenienceScore() {
        return convenienceScore;
    }

    public void setConvenienceScore(Double convenienceScore) {
        this.convenienceScore = convenienceScore;
    }

    public Double getChoiceConfidenceScore() {
        return choiceConfidenceScore;
    }

    public void setChoiceConfidenceScore(Double choiceConfidenceScore) {
        this.choiceConfidenceScore = choiceConfidenceScore;
    }

    public Integer getSpaceAccuracy() {
        return spaceAccuracy;
    }

    public void setSpaceAccuracy(Integer spaceAccuracy) {
        this.spaceAccuracy = spaceAccuracy;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public List<SurveyAnswer> getAnswers() {
        return answers;
    }
}

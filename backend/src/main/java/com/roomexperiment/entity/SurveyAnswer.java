package com.roomexperiment.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.util.UUID;

@Entity
@Table(
        name = "survey_answers",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_room_question",
                columnNames = {"room_survey_id", "question_code"}
        )
)
public class SurveyAnswer {
    public SurveyAnswer(RoomSurvey roomSurvey, String questionCode, String answerText, Integer answerScore) {
        this.roomSurvey = roomSurvey;
        this.questionCode = questionCode;
        this.answerText = answerText;
        this.answerScore = answerScore;
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "room_survey_id", nullable = false)
    private RoomSurvey roomSurvey;

    @Column(nullable = false)
    private String questionCode;

    @Column(name = "answer_text")
    private String answerText;

    @Column(name = "answer_score")
    private Integer answerScore;

    protected SurveyAnswer() {
    }

    public UUID getId() {
        return id;
    }

    public RoomSurvey getRoomSurvey() {
        return roomSurvey;
    }

    public void setRoomSurvey(RoomSurvey roomSurvey) {
        this.roomSurvey = roomSurvey;
    }

    public String getQuestionCode() {
        return questionCode;
    }

    public void setQuestionCode(String questionCode) {
        this.questionCode = questionCode;
    }

    public String getAnswerText() {
        return answerText;
    }

    public void setAnswerText(String answerText) {
        this.answerText = answerText;
    }

    public Integer getAnswerScore() {
        return answerScore;
    }

    public void setAnswerScore(Integer answerScore) {
        this.answerScore = answerScore;
    }
}

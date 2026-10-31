package com.roomexperiment.service;

import com.roomexperiment.domain.RoomCode;
import com.roomexperiment.domain.ViewMode;
import com.roomexperiment.dto.CompleteExplorationResponse;
import com.roomexperiment.dto.CreateExperimentResponse;
import com.roomexperiment.dto.RoomSurveyResponse;
import com.roomexperiment.dto.StartRoomResponse;
import com.roomexperiment.entity.ExperimentSession;
import com.roomexperiment.entity.RoomSurvey;
import com.roomexperiment.entity.SurveyAnswer;
import com.roomexperiment.repository.ExperimentSessionRepository;
import com.roomexperiment.repository.RoomSurveyRepository;
import com.roomexperiment.repository.SurveyAnswerRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ExperimentService {

    private final ExperimentSessionRepository experimentSessionRepository;
    private final RoomSurveyRepository roomSurveyRepository;
    private final SurveyAnswerRepository surveyAnswerRepository;

    public ExperimentService(
            ExperimentSessionRepository experimentSessionRepository,
            RoomSurveyRepository roomSurveyRepository,
            SurveyAnswerRepository surveyAnswerRepository
    ) {
        this.experimentSessionRepository = experimentSessionRepository;
        this.roomSurveyRepository = roomSurveyRepository;
        this.surveyAnswerRepository = surveyAnswerRepository;
    }

    @Transactional
    public CreateExperimentResponse startExperiment() {
        // TODO: A방 화면이 표시될 때 익명 참가자 코드와 세션을 저장한다.
        Instant createdAt = Instant.now();
        String participationCode = UUID.randomUUID().toString();

        ExperimentSession session = new ExperimentSession(participationCode, createdAt);
        RoomSurvey roomSurvey = new RoomSurvey(RoomCode.A, ViewMode.PHOTO);
        session.addRoomSurvey(roomSurvey);

        session = experimentSessionRepository.save(session);
    
        return new CreateExperimentResponse(
            session.getId(),
            session.getParticipantCode()
        );
    }

    @Transactional
    public StartRoomResponse startRoom(UUID experimentId, RoomCode roomCode, ViewMode viewMode) {
        if (roomCode != RoomCode.B) {
            throw new IllegalArgumentException("이 API는 B방 시작 전용입니다.");
        }

        if (viewMode != ViewMode.RENDERING) {
            throw new IllegalArgumentException("B방 확인 방식은 RENDERING이어야 합니다.");
        }

        ExperimentSession session = experimentSessionRepository.findById(experimentId)
            .orElseThrow(() -> new IllegalArgumentException("실험 세션을 찾을 수 없습니다."));

        RoomSurvey roomA = roomSurveyRepository
                .findByExperimentSession_IdAndRoomCode(experimentId, RoomCode.A)
                .orElseThrow(() -> new IllegalStateException("A방 기록을 찾을 수 없습니다."));

        if (roomA.getSubmittedAt() == null) {
            throw new IllegalStateException("A방 설문 제출 후 B방을 시작할 수 있습니다.");
        }

        RoomSurvey existingRoom = roomSurveyRepository
                .findByExperimentSession_IdAndRoomCode(experimentId, roomCode)
                .orElse(null);

        if (existingRoom != null) {
            if (existingRoom.getViewMode() != viewMode) {
                throw new IllegalStateException("이미 다른 확인 방식으로 시작한 객실입니다.");
            }
            return new StartRoomResponse(experimentId, roomCode);
        }
        
        RoomSurvey roomSurvey = new RoomSurvey(roomCode, viewMode);
        session.addRoomSurvey(roomSurvey);
        roomSurveyRepository.save(roomSurvey);

        return new StartRoomResponse(experimentId, roomCode);
    }

    @Transactional
    public CompleteExplorationResponse completeExploration(
            UUID experimentId,
            RoomCode roomCode,
            long explorationMillis
    ) {
        RoomSurvey roomSurvey = roomSurveyRepository.findByExperimentSession_IdAndRoomCode(experimentId, roomCode)
            .orElseThrow(() -> new IllegalArgumentException("객실 기록을 찾을 수 없습니다."));

        if (roomSurvey.getExplorationMillis() != null) {
            if (roomSurvey.getExplorationMillis() == explorationMillis) {
                return new CompleteExplorationResponse(
                        experimentId,
                        roomCode,
                        roomSurvey.getExplorationMillis()
                );
            }
            throw new IllegalStateException("다른 탐색 시간으로 이미 완료 처리되었습니다.");
        }

        roomSurvey.setExplorationMillis(explorationMillis);

        roomSurveyRepository.save(roomSurvey);

        return new CompleteExplorationResponse(
                experimentId,
                roomCode,
                roomSurvey.getExplorationMillis()
        );
    }

@Transactional
public RoomSurveyResponse submitRoomSurvey(
        UUID experimentId,
        RoomCode roomCode,
        Map<String, String> answers
) {
        RoomSurvey roomSurvey = roomSurveyRepository
                .findByExperimentSession_IdAndRoomCode(experimentId, roomCode)
                .orElseThrow(() -> new IllegalArgumentException("객실 기록을 찾을 수 없습니다."));

        if (roomSurvey.getExplorationMillis() == null) {
            throw new IllegalStateException("객실 탐색을 먼저 완료해야 합니다.");
        }

        Set<String> expectedCodes = Set.of(
                "s1", "s2", "s3", "s4", "s5",
                "q1", "q2", "q3", "q4", "q5"
        );

        if (!answers.keySet().equals(expectedCodes)) {
            throw new IllegalArgumentException("설문 문항 10개에 모두 응답해 주세요.");
        }

        if (roomSurvey.getSubmittedAt() != null) {
            List<SurveyAnswer> existingAnswers = surveyAnswerRepository
                    .findAllByRoomSurvey_Id(roomSurvey.getId());
            Map<String, SurveyAnswer> existingByCode = new HashMap<>();
            existingAnswers.forEach(answer -> existingByCode.put(answer.getQuestionCode(), answer));

            boolean sameAnswers = expectedCodes.stream().allMatch(questionCode -> {
                SurveyAnswer savedAnswer = existingByCode.get(questionCode);
                if (savedAnswer == null) return false;

                String submittedValue = answers.get(questionCode);
                if (questionCode.startsWith("s")) {
                    try {
                        return savedAnswer.getAnswerScore() != null
                                && savedAnswer.getAnswerScore() == Integer.parseInt(submittedValue);
                    } catch (NumberFormatException e) {
                        return false;
                    }
                }
                return Objects.equals(savedAnswer.getAnswerText(), submittedValue);
            });

            if (!sameAnswers) {
                throw new IllegalStateException("이미 다른 응답으로 설문을 제출했습니다.");
            }

            return new RoomSurveyResponse(
                    experimentId,
                    roomCode,
                    roomSurvey.getViewMode(),
                    roomSurvey.getExplorationMillis(),
                    roomSurvey.getConvenienceScore(),
                    roomSurvey.getChoiceConfidenceScore(),
                    roomSurvey.getSubmittedAt(),
                    roomSurvey.getSpaceAccuracy(),
                    existingAnswers.size()
            );
        }

        Map<String, String> correctAnswers = roomCode == RoomCode.A
                ? Map.of(
                        "q1", "창문",
                        "q2", "등 뒤쪽",
                        "q3", "세면대",
                        "q4", "왼쪽",
                        "q5", "B"
                )
                : Map.of(
                        "q1", "아무것도 없음",
                        "q2", "왼쪽",
                        "q3", "그냥 벽",
                        "q4", "오른쪽",
                        "q5", "C"
                );

        List<SurveyAnswer> savedAnswers = new ArrayList<>();
        int correctCount = 0;

        for (int i = 1; i <= 5; i++) {
            String questionCode = "s" + i;
            int score = Integer.parseInt(answers.get(questionCode));

            if (score < 1 || score > 7) {
                throw new IllegalArgumentException("척도형 답변은 1점에서 7점 사이여야 합니다.");
            }

            savedAnswers.add(
                    new SurveyAnswer(roomSurvey, questionCode, null, score)
            );
        }

        for (int i = 1; i <= 5; i++) {
            String questionCode = "q" + i;
            String answerText = answers.get(questionCode);

            if (answerText.equals(correctAnswers.get(questionCode))) {
                correctCount++;
            }

            savedAnswers.add(
                    new SurveyAnswer(roomSurvey, questionCode, answerText, null)
            );
        }

        double convenienceScore = (
                Integer.parseInt(answers.get("s1"))
                        + Integer.parseInt(answers.get("s2"))
        ) / 2.0;
        double choiceConfidenceScore = (
                Integer.parseInt(answers.get("s3"))
                        + Integer.parseInt(answers.get("s4"))
                        + Integer.parseInt(answers.get("s5"))
        ) / 3.0;
        int spaceAccuracy = correctCount * 20;

        Instant submittedAt = Instant.now();
        roomSurvey.setSubmittedAt(submittedAt);
        roomSurvey.setConvenienceScore(convenienceScore);
        roomSurvey.setChoiceConfidenceScore(choiceConfidenceScore);
        roomSurvey.setSpaceAccuracy(spaceAccuracy);

        surveyAnswerRepository.saveAll(savedAnswers);
        roomSurveyRepository.save(roomSurvey);

        return new RoomSurveyResponse(
                experimentId,
                roomCode,
                roomSurvey.getViewMode(),
                roomSurvey.getExplorationMillis(),
                convenienceScore,
                choiceConfidenceScore,
                submittedAt,
                spaceAccuracy,
                savedAnswers.size()
        );
    }
}

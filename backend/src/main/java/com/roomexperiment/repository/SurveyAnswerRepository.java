package com.roomexperiment.repository;

import com.roomexperiment.entity.SurveyAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SurveyAnswerRepository extends JpaRepository<SurveyAnswer, UUID> {

    List<SurveyAnswer> findAllByRoomSurvey_Id(UUID roomSurveyId);
}

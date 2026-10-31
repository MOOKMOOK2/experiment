package com.roomexperiment.repository;

import com.roomexperiment.entity.ExperimentSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ExperimentSessionRepository extends JpaRepository<ExperimentSession, UUID> {
}

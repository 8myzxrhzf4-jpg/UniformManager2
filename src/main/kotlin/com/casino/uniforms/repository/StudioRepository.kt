package com.casino.uniforms.repository

import com.casino.uniforms.model.Studio
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import java.util.*;

@Repository
interface StudioRepository : JpaRepository<Studio, Long> {
    fun findByNameAndCity_Name(name: String, cityName: String): Optional<Studio>

    @Modifying
    @Query("UPDATE Studio s SET s.currentHamperCount = s.currentHamperCount + 1 WHERE s.id = :id AND s.currentHamperCount < s.hamperCapacity")
    fun incrementHamperIfNotFull(@Param("id") id: Long): Int

    @Modifying
    @Query("UPDATE Studio s SET s.currentHamperCount = 0 WHERE s.id = :id")
    fun resetHamperCount(@Param("id") id: Long): Int
}
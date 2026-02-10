package com.casino.uniforms.service

import com.casino.uniforms.exception.ResourceNotFoundException
import com.casino.uniforms.repository.StudioRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class HamperService(
    private val studioRepository: StudioRepository
) {
    private val logger = LoggerFactory.getLogger(HamperService::class.java)
    
    @Transactional
    fun addToHamper(studioId: Long) {
        val studio = studioRepository.findById(studioId)
            .orElseThrow { ResourceNotFoundException("Studio with id $studioId not found") }
        
        val newCount = studio.currentHamperCount + 1
        
        // Soft limit - allow exceeding capacity but warn
        if (newCount > studio.hamperCapacity) {
            logger.warn("Studio ${studio.name} hamper count ($newCount) exceeds capacity (${studio.hamperCapacity})")
        }
        
        studio.currentHamperCount = newCount
        studioRepository.save(studio)
    }
    
    @Transactional
    fun removeFromHamper(studioId: Long) {
        val studio = studioRepository.findById(studioId)
            .orElseThrow { ResourceNotFoundException("Studio with id $studioId not found") }
        
        // Decrement count, but don't go below 0
        if (studio.currentHamperCount > 0) {
            studio.currentHamperCount -= 1
            studioRepository.save(studio)
        } else {
            logger.warn("Studio ${studio.name} hamper count is already 0, cannot decrement")
        }
    }
    
    @Transactional
    fun resetHamper(studioId: Long) {
        studioRepository.resetHamperCount(studioId)
    }
}

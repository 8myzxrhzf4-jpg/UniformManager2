package com.casino.uniforms.service

import com.casino.uniforms.model.Studio
import com.casino.uniforms.repository.StudioRepository
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.*
import org.mockito.junit.jupiter.MockitoExtension
import java.util.*

@ExtendWith(MockitoExtension::class)
class HamperServiceTest {

    @Mock
    private lateinit var studioRepository: StudioRepository

    @InjectMocks
    private lateinit var hamperService: HamperService

    private lateinit var studio: Studio

    @BeforeEach
    fun setUp() {
        studio = Studio()
        studio.id = 1L
        studio.name = "Test Studio"
        studio.hamperCapacity = 10
        studio.currentHamperCount = 0
    }

    @Test
    fun `incrementHamper should return false when below capacity`() {
        // Given
        studio.currentHamperCount = 5
        `when`(studioRepository.findById(1L)).thenReturn(Optional.of(studio))
        `when`(studioRepository.incrementHamper(1L)).thenReturn(1)

        // When
        val result = hamperService.incrementHamper(1L)

        // Then
        assertFalse(result, "Should return false when below capacity")
        verify(studioRepository).incrementHamper(1L)
    }

    @Test
    fun `incrementHamper should return true when at capacity`() {
        // Given
        studio.currentHamperCount = 9
        `when`(studioRepository.findById(1L)).thenReturn(Optional.of(studio))
        `when`(studioRepository.incrementHamper(1L)).thenReturn(1)

        // When
        val result = hamperService.incrementHamper(1L)

        // Then
        assertTrue(result, "Should return true when at capacity")
        verify(studioRepository).incrementHamper(1L)
    }

    @Test
    fun `incrementHamper should return true when over capacity`() {
        // Given - already at capacity
        studio.currentHamperCount = 10
        `when`(studioRepository.findById(1L)).thenReturn(Optional.of(studio))
        `when`(studioRepository.incrementHamper(1L)).thenReturn(1)

        // When
        val result = hamperService.incrementHamper(1L)

        // Then
        assertTrue(result, "Should return true when going over capacity (soft limit)")
        verify(studioRepository).incrementHamper(1L)
    }

    @Test
    fun `incrementHamper should throw exception when studio not found`() {
        // Given
        `when`(studioRepository.findById(999L)).thenReturn(Optional.empty())

        // When/Then
        assertThrows(IllegalArgumentException::class.java) {
            hamperService.incrementHamper(999L)
        }
    }

    @Test
    fun `decrementHamper should call repository method`() {
        // Given
        `when`(studioRepository.decrementHamper(1L)).thenReturn(1)

        // When
        hamperService.decrementHamper(1L)

        // Then
        verify(studioRepository).decrementHamper(1L)
    }

    @Test
    fun `resetHamper should call repository method`() {
        // Given
        `when`(studioRepository.resetHamperCount(1L)).thenReturn(1)

        // When
        hamperService.resetHamper(1L)

        // Then
        verify(studioRepository).resetHamperCount(1L)
    }
}

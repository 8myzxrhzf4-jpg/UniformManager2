package com.casino.uniforms.controller

import com.casino.uniforms.service.HamperService
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mockito.`when`
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest
import org.springframework.boot.test.mock.mockito.MockBean
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*

@ExtendWith(SpringExtension::class)
@WebMvcTest(LaundryController::class)
class LaundryControllerTest {

    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockBean
    private lateinit var hamperService: HamperService

    @Test
    fun `dropoff should return response without warning when below capacity`() {
        // Given
        `when`(hamperService.incrementHamper(1L)).thenReturn(false)

        // When/Then
        mockMvc.perform(post("/api/laundry/dropoff")
            .param("studioId", "1")
            .param("itemCount", "1"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.studioId").value(1))
            .andExpect(jsonPath("$.data.itemCount").value(1))
            .andExpect(jsonPath("$.data.status").value("dropped off"))
            .andExpect(jsonPath("$.warnings").isEmpty)
    }

    @Test
    fun `dropoff should return response with warning when at or over capacity`() {
        // Given
        `when`(hamperService.incrementHamper(1L)).thenReturn(true)

        // When/Then
        mockMvc.perform(post("/api/laundry/dropoff")
            .param("studioId", "1")
            .param("itemCount", "1"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.studioId").value(1))
            .andExpect(jsonPath("$.data.itemCount").value(1))
            .andExpect(jsonPath("$.data.status").value("dropped off"))
            .andExpect(jsonPath("$.warnings[0]").value("Warning: Hamper at studio 1 is at or over capacity"))
    }

    @Test
    fun `pickup should return success response`() {
        // When/Then
        mockMvc.perform(post("/api/laundry/pickup")
            .param("studioId", "1")
            .param("itemCount", "2"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.studioId").value(1))
            .andExpect(jsonPath("$.data.itemCount").value(2))
            .andExpect(jsonPath("$.data.status").value("picked up"))
            .andExpect(jsonPath("$.warnings").isEmpty)
    }

    @Test
    fun `reset should return success response`() {
        // When/Then
        mockMvc.perform(post("/api/laundry/reset")
            .param("studioId", "1"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.studioId").value(1))
            .andExpect(jsonPath("$.data.status").value("reset"))
            .andExpect(jsonPath("$.warnings").isEmpty)
    }
}

package com.casino.uniforms.exception

class DuplicateBarcodeException(message: String) : RuntimeException(message)

class InvalidStatusTransitionException(message: String) : RuntimeException(message)

class ResourceNotFoundException(message: String) : RuntimeException(message)

class InvalidStatusException(message: String) : RuntimeException(message)

package com.om.backend.exceptions;


public class ForbiddenException extends RuntimeException {
    public ForbiddenException() { super("Forbidden"); }
    public ForbiddenException(String msg) { super(msg); }
}


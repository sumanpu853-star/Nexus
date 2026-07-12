# Refactoring Plan

This plan starts from architecture and moves step by step as code is added.

## Step 1: Establish Boundaries

Define the first runtime, entry point, and module ownership. Avoid adding framework-specific structure until the first real workflow is known.

## Step 2: Identify Core Behavior

Separate the first durable business rules from I/O code. The goal is a small core that can be tested without external services.

## Step 3: Wrap Integrations

Put databases, APIs, queues, filesystems, and vendor SDKs behind narrow adapters. Application code should depend on intent-focused interfaces rather than implementation details.

## Step 4: Add Characterization Tests

Before changing existing behavior, capture what it currently does. Keep tests focused on outcomes and boundaries rather than private implementation details.

## Step 5: Refactor in Thin Slices

Move one responsibility at a time, run validation, and keep commits reviewable. Prefer small structural improvements that reduce coupling immediately.

## Step 6: Revisit Architecture

After each meaningful feature or refactor, update the architecture document and add an ADR when a decision changes long-term direction.

import { interviewModel } from '../models/interviewSchema.js';

/**
 * Simple unit tests for Interview Model
 * 
 * Tests validation logic and status transitions without database dependencies
 * Requirements: 3.2, 3.3
 */

function runTests() {
  console.log('Starting Interview Model Simple Tests...\n');

  try {
    // Test 1: Valid Status Values
    testValidStatuses();

    // Test 2: Valid Transitions
    testValidTransitions();

    // Test 3: Invalid Transitions
    testInvalidTransitions();

    // Test 4: Transition Validation Logic
    testTransitionValidation();

    console.log('\n✅ All Interview Model simple tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

function testValidStatuses() {
  console.log('Test 1: Valid Status Values');

  const validStatuses = interviewModel.getValidStatuses();

  const expectedStatuses = [
    'invitation_sent',
    'slot_pending',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
    'expired'
  ];

  if (validStatuses.length !== expectedStatuses.length) {
    throw new Error(`Expected ${expectedStatuses.length} statuses, got ${validStatuses.length}`);
  }

  for (const status of expectedStatuses) {
    if (!validStatuses.includes(status)) {
      throw new Error(`Missing expected status: ${status}`);
    }
  }

  console.log('✓ All 7 valid statuses present');
  console.log(`  Statuses: ${validStatuses.join(', ')}`);
}

function testValidTransitions() {
  console.log('\nTest 2: Valid Transitions');

  // Test: invitation_sent transitions
  let transitions = interviewModel.getValidTransitions('invitation_sent');
  const expectedFromInvitation = ['slot_pending', 'cancelled', 'expired'];
  
  if (transitions.length !== expectedFromInvitation.length) {
    throw new Error('Wrong number of transitions from invitation_sent');
  }

  for (const transition of expectedFromInvitation) {
    if (!transitions.includes(transition)) {
      throw new Error(`Missing transition from invitation_sent: ${transition}`);
    }
  }
  console.log('✓ invitation_sent transitions: ' + transitions.join(', '));

  // Test: slot_pending transitions
  transitions = interviewModel.getValidTransitions('slot_pending');
  const expectedFromSlotPending = ['confirmed', 'expired'];
  
  if (transitions.length !== expectedFromSlotPending.length) {
    throw new Error('Wrong number of transitions from slot_pending');
  }

  for (const transition of expectedFromSlotPending) {
    if (!transitions.includes(transition)) {
      throw new Error(`Missing transition from slot_pending: ${transition}`);
    }
  }
  console.log('✓ slot_pending transitions: ' + transitions.join(', '));

  // Test: confirmed transitions
  transitions = interviewModel.getValidTransitions('confirmed');
  const expectedFromConfirmed = ['completed', 'no_show', 'cancelled'];
  
  if (transitions.length !== expectedFromConfirmed.length) {
    throw new Error('Wrong number of transitions from confirmed');
  }

  for (const transition of expectedFromConfirmed) {
    if (!transitions.includes(transition)) {
      throw new Error(`Missing transition from confirmed: ${transition}`);
    }
  }
  console.log('✓ confirmed transitions: ' + transitions.join(', '));
}

function testInvalidTransitions() {
  console.log('\nTest 3: Invalid Transitions');

  // Test: invitation_sent → completed (invalid)
  if (interviewModel.isValidTransition('invitation_sent', 'completed')) {
    throw new Error('Should reject invitation_sent → completed');
  }
  console.log('✓ Rejected: invitation_sent → completed');

  // Test: invitation_sent → no_show (invalid)
  if (interviewModel.isValidTransition('invitation_sent', 'no_show')) {
    throw new Error('Should reject invitation_sent → no_show');
  }
  console.log('✓ Rejected: invitation_sent → no_show');

  // Test: slot_pending → completed (invalid)
  if (interviewModel.isValidTransition('slot_pending', 'completed')) {
    throw new Error('Should reject slot_pending → completed');
  }
  console.log('✓ Rejected: slot_pending → completed');

  // Test: slot_pending → cancelled (invalid)
  if (interviewModel.isValidTransition('slot_pending', 'cancelled')) {
    throw new Error('Should reject slot_pending → cancelled');
  }
  console.log('✓ Rejected: slot_pending → cancelled');

  // Test: completed → confirmed (invalid - terminal state)
  if (interviewModel.isValidTransition('completed', 'confirmed')) {
    throw new Error('Should reject completed → confirmed');
  }
  console.log('✓ Rejected: completed → confirmed (terminal state)');

  // Test: expired → slot_pending (invalid - terminal state)
  if (interviewModel.isValidTransition('expired', 'slot_pending')) {
    throw new Error('Should reject expired → slot_pending');
  }
  console.log('✓ Rejected: expired → slot_pending (terminal state)');
}

function testTransitionValidation() {
  console.log('\nTest 4: Transition Validation Logic');

  // Test: Same status is always valid
  if (!interviewModel.isValidTransition('invitation_sent', 'invitation_sent')) {
    throw new Error('Should allow staying in same status');
  }
  console.log('✓ Same status transition allowed');

  // Test: Valid transition chain
  const validChain = [
    ['invitation_sent', 'slot_pending'],
    ['slot_pending', 'confirmed'],
    ['confirmed', 'completed']
  ];

  for (const [from, to] of validChain) {
    if (!interviewModel.isValidTransition(from, to)) {
      throw new Error(`Valid transition rejected: ${from} → ${to}`);
    }
  }
  console.log('✓ Valid transition chain: invitation_sent → slot_pending → confirmed → completed');

  // Test: Alternative valid paths
  const alternativePaths = [
    ['invitation_sent', 'cancelled'],
    ['invitation_sent', 'expired'],
    ['slot_pending', 'expired'],
    ['confirmed', 'no_show'],
    ['confirmed', 'cancelled']
  ];

  for (const [from, to] of alternativePaths) {
    if (!interviewModel.isValidTransition(from, to)) {
      throw new Error(`Valid alternative path rejected: ${from} → ${to}`);
    }
  }
  console.log('✓ All alternative valid paths accepted');

  // Test: Invalid jumps
  const invalidJumps = [
    ['invitation_sent', 'confirmed'],
    ['invitation_sent', 'completed'],
    ['slot_pending', 'no_show'],
    ['slot_pending', 'completed']
  ];

  for (const [from, to] of invalidJumps) {
    if (interviewModel.isValidTransition(from, to)) {
      throw new Error(`Invalid jump accepted: ${from} → ${to}`);
    }
  }
  console.log('✓ All invalid jumps rejected');
}

// Run tests
runTests();

'use client';

import React from 'react';
import {
  SensitiveActionConfirmationModal,
  SensitiveActionConfirmationProps,
} from './SensitiveActionConfirmationModal';

/**
 * Legacy wrapper: forwards directly to SensitiveActionConfirmationModal.
 * Decommissions 6-digit OTP in favor of GitHub-style Typed Confirmation.
 */
export function DoubleVerificationModal(props: any) {
  return (
    <SensitiveActionConfirmationModal
      isOpen={props.isOpen}
      onClose={props.onClose}
      actionTitle={props.actionTitle || 'Sensitive Operation'}
      actionDescription={props.actionDescription || 'Please confirm to proceed'}
      targetResourceType={props.resourceType}
      targetResourceName={props.resourceId}
      expectedConfirmationPhrase={props.expectedConfirmationPhrase || 'CONFIRM SENSITIVE ACTION'}
      onConfirmed={props.onVerified || props.onConfirmed}
    />
  );
}

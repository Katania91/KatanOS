import { createPortal } from 'react-dom';
import { ReactNode } from 'react';

interface ModalPortalProps {
  children: ReactNode;
}

// Portal that renders modals directly to document.body
// This bypasses any transform or overflow constraints from parent elements
const ModalPortal = ({ children }: ModalPortalProps) => {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
};

export default ModalPortal;

import React from 'react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-4 text-brand-primary">{title}</h2>
        <div className="text-gray-700 dark:text-gray-300 space-y-4">
          {children}
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="bg-brand-primary text-white py-2 px-6 rounded-md hover:bg-brand-secondary">
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;

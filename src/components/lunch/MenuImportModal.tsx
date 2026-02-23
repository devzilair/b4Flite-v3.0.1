
import React, { useState, useMemo } from 'react';
import { parseMenuImage, ParsedMenuDay } from '../../services/geminiService';
import { LunchMenu, LunchOption } from '../../types';

interface MenuImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (menus: LunchMenu[]) => Promise<void>;
}

const MenuImportModal: React.FC<MenuImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const today = new Date();
    const [step, setStep] = useState<'upload' | 'review'>('upload');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [drafts, setDrafts] = useState<ParsedMenuDay[]>([]);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleProcess = async () => {
        if (!selectedFile) return;
        setLoading(true);
        setError(null);
        try {
            const results = await parseMenuImage(selectedFile, year, month);
            setDrafts(results);
            setStep('review');
        } catch (err: any) {
            setError(err.message || "Failed to parse image.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const menusToSave: LunchMenu[] = drafts.map(d => {
                const date = new Date(d.date);
                date.setDate(date.getDate() - 1);
                date.setHours(12, 0, 0, 0);

                return {
                    date: d.date,
                    cutoffTime: date.toISOString(),
                    options: d.options.map((opt, i) => ({
                        id: `opt_${Date.now()}_${i}`,
                        name: opt.name,
                        description: opt.description,
                        availableCondiments: opt.availableCondiments
                    }))
                };
            });
            await onImport(menusToSave);
            onClose();
        } catch (err: any) {
            setError("Failed to save menus.");
        } finally {
            setLoading(false);
        }
    };

    const updateDraft = (idx: number, optIdx: number, field: string, value: string) => {
        const newDrafts = [...drafts];
        // @ts-ignore
        newDrafts[idx].options[optIdx][field] = value;
        setDrafts(newDrafts);
    };

    const removeRow = (idx: number) => {
        setDrafts(drafts.filter((_, i) => i !== idx));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                             <span>✨</span> AI Menu Importer
                        </h2>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Automated extraction via Gemini 1.5</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-3xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto p-6">
                    {step === 'upload' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Target Month & Year</label>
                                    <div className="flex gap-4">
                                        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="flex-1 p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                            {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                                                <option key={m} value={i + 1}>{m}</option>
                                            ))}
                                        </select>
                                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-24 p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                </div>

                                <div className="p-8 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl text-center bg-indigo-50/30 dark:bg-indigo-900/10">
                                    <input type="file" accept="image/*,application/pdf" onChange={handleFileChange} id="menu-file" className="hidden" />
                                    <label htmlFor="menu-file" className="cursor-pointer block">
                                        <div className="text-5xl mb-4">📄</div>
                                        <p className="font-bold text-indigo-900 dark:text-indigo-200">Upload Menu Image or PDF</p>
                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">Take a photo or upload a digital file</p>
                                    </label>
                                </div>

                                {selectedFile && (
                                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                                        <div className="text-2xl">📎</div>
                                        <div className="flex-grow min-w-0">
                                            <p className="text-sm font-bold truncate">{selectedFile.name}</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-tighter">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                                        </div>
                                        <button onClick={() => setSelectedFile(null)} className="text-red-500 font-bold">&times;</button>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200 animate-fade-in">
                                        <strong>Error:</strong> {error}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-100 dark:bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden border dark:border-gray-700 min-h-[300px]">
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <div className="text-center text-gray-400 p-8">
                                        <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <p className="text-xs uppercase font-bold tracking-widest">Image Preview Area</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-bold text-gray-700 dark:text-gray-300">Detected Menus ({drafts.length})</h3>
                                <button onClick={() => setStep('upload')} className="text-xs text-indigo-600 hover:underline font-bold uppercase">Upload Different File</button>
                            </div>

                            <div className="overflow-x-auto border rounded-lg dark:border-gray-700">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 uppercase">
                                        <tr>
                                            <th className="p-3 w-32">Date</th>
                                            <th className="p-3">Dishes & Options</th>
                                            <th className="p-3 w-16 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {drafts.map((d, idx) => (
                                            <tr key={idx} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="p-3 font-bold">{new Date(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</td>
                                                <td className="p-3">
                                                    <div className="space-y-2">
                                                        {d.options.map((opt, oIdx) => (
                                                            <div key={oIdx} className="flex gap-2">
                                                                <input 
                                                                    value={opt.name}
                                                                    onChange={e => updateDraft(idx, oIdx, 'name', e.target.value)}
                                                                    className="flex-grow p-1 text-xs border rounded bg-transparent focus:ring-1 focus:ring-indigo-500"
                                                                />
                                                                <div className="text-[10px] text-gray-400 whitespace-nowrap pt-1">
                                                                    Sides: {opt.availableCondiments.join(', ')}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">&times;</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-gray-400 italic">Please review the extracted data for typos before saving. Sides found in the footer were automatically applied to all dishes.</p>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-3 rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                    {step === 'upload' ? (
                        <button 
                            onClick={handleProcess}
                            disabled={loading || !selectedFile}
                            className="px-8 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg disabled:opacity-50 transition-all flex items-center gap-2"
                        >
                            {loading ? <><div className="animate-spin h-4 w-4 border-2 border-white/20 border-t-white rounded-full"></div> Extracting...</> : 'Start AI Analysis'}
                        </button>
                    ) : (
                        <button 
                            onClick={handleSave}
                            disabled={loading || drafts.length === 0}
                            className="px-8 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-lg font-bold shadow-lg disabled:opacity-50 transition-all"
                        >
                            {loading ? 'Saving...' : 'Confirm & Save All'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MenuImportModal;

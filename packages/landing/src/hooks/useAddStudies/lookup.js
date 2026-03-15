/**
 * DOI/PMID lookup operations for useAddStudies (React version)
 */

import { useState, useCallback } from 'react';
import { showToast } from '@/components/ui/toast';
import { fetchReferenceByIdentifier, parseIdentifiers } from '@/lib/referenceLookup.js';
import { cloneArrayBuffer } from './serialization.js';

export function useLookupOperations() {
  const [identifierInput, setIdentifierInput] = useState('');
  const [lookupRefs, setLookupRefs] = useState([]);
  const [selectedLookupIds, setSelectedLookupIds] = useState(new Set());
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupErrors, setLookupErrors] = useState([]);

  const lookupCount = selectedLookupIds.size;

  const handleLookup = useCallback(async () => {
    const input = identifierInput.trim();
    if (!input) return;

    const identifiers = parseIdentifiers(input);
    if (identifiers.length === 0) {
      showToast.warning('No Identifiers', 'Could not find any valid DOIs or PMIDs in the input.');
      return;
    }

    setLookingUp(true);
    setLookupErrors([]);

    try {
      const newRefs = [];
      const errors = [];

      for (const id of identifiers) {
        try {
          const ref = await fetchReferenceByIdentifier(id);
          if (ref) newRefs.push({ ...ref, _id: `lookup-${crypto.randomUUID()}` });
        } catch (error) {
          errors.push({ identifier: id, error: error.message || 'Lookup failed' });
        }
      }

      if (newRefs.length > 0) {
        setLookupRefs(prev => [...prev, ...newRefs]);
        setSelectedLookupIds(prev => {
          const next = new Set(prev);
          newRefs.filter(r => r.pdfAvailable).forEach(r => next.add(r._id));
          return next;
        });
        setIdentifierInput('');
      }

      if (errors.length > 0) setLookupErrors(errors);
    } catch (error) {
      console.error('Lookup error:', error);
      showToast.error('Lookup Failed', 'An error occurred during lookup.');
    } finally {
      setLookingUp(false);
    }
  }, [identifierInput]);

  const toggleLookupSelection = useCallback(
    id => {
      const ref = lookupRefs.find(r => r._id === id);
      if (!ref?.pdfAvailable) return;
      setSelectedLookupIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    },
    [lookupRefs],
  );

  const toggleSelectAllLookup = useCallback(() => {
    const refsWithPdf = lookupRefs.filter(r => r.pdfAvailable);
    setSelectedLookupIds(prev => {
      const allSelected = refsWithPdf.every(r => prev.has(r._id));
      return allSelected ? new Set() : new Set(refsWithPdf.map(r => r._id));
    });
  }, [lookupRefs]);

  const removeLookupRef = useCallback(id => {
    setLookupRefs(prev => prev.filter(r => r._id !== id));
    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const clearLookupRefs = useCallback(() => {
    setLookupRefs([]);
    setSelectedLookupIds(new Set());
    setLookupErrors([]);
  }, []);

  const attachPdfToLookupRef = useCallback((refId, fileName, arrayBuffer) => {
    setLookupRefs(prev =>
      prev.map(ref =>
        ref._id === refId ? { ...ref, manualPdfData: arrayBuffer, manualPdfFileName: fileName } : ref,
      ),
    );
  }, []);

  const markRefMatched = useCallback((refId, pdfData, pdfFileName) => {
    setLookupRefs(prev =>
      prev.map(r =>
        r._id === refId
          ? { ...r, pdfAvailable: true, manualPdfData: pdfData, manualPdfFileName: pdfFileName, matchedFromUpload: true }
          : r,
      ),
    );
    setSelectedLookupIds(prev => {
      const next = new Set(prev);
      next.add(refId);
      return next;
    });
  }, []);

  const getSerializableState = useCallback(
    () => ({
      identifierInput,
      lookupRefs: lookupRefs.map(ref => ({
        _id: ref._id,
        title: ref.title,
        doi: ref.doi,
        firstAuthor: ref.firstAuthor,
        publicationYear: ref.publicationYear,
        authors: ref.authors ? [...ref.authors] : null,
        journal: ref.journal,
        abstract: ref.abstract,
        pdfUrl: ref.pdfUrl,
        pdfSource: ref.pdfSource,
        pdfAccessible: ref.pdfAccessible,
        pdfAvailable: ref.pdfAvailable,
        manualPdfData: cloneArrayBuffer(ref.manualPdfData),
        manualPdfFileName: ref.manualPdfFileName,
        matchedFromUpload: ref.matchedFromUpload,
      })),
      selectedLookupIds: Array.from(selectedLookupIds),
    }),
    [identifierInput, lookupRefs, selectedLookupIds],
  );

  const restoreState = useCallback(savedState => {
    if (savedState.identifierInput) setIdentifierInput(savedState.identifierInput);
    if (savedState.lookupRefs?.length > 0) setLookupRefs(savedState.lookupRefs);
    if (savedState.selectedLookupIds?.length > 0)
      setSelectedLookupIds(new Set(savedState.selectedLookupIds));
  }, []);

  return {
    identifierInput,
    setIdentifierInput,
    lookupRefs,
    selectedLookupIds,
    lookingUp,
    lookupErrors,
    lookupCount,
    handleLookup,
    toggleLookupSelection,
    toggleSelectAllLookup,
    removeLookupRef,
    clearLookupRefs,
    attachPdfToLookupRef,
    markRefMatched,
    getSerializableState,
    restoreState,
  };
}

import { DocumentReference, DocumentData } from '@firebase/firestore'
import { useMemo } from 'react'
import { useDocumentData } from 'react-firebase-hooks/firestore'

const snapshotOptions = {
  serverTimestamps: 'estimate',
} as const

export const useDocument = <T extends DocumentData>(
  docRef: DocumentReference<T> | undefined
) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const innerDocRef = useMemo(() => docRef, [docRef?.path])
  return useDocumentData<T, 'id', 'ref'>(innerDocRef, {
    idField: 'id',
    refField: 'ref',
    snapshotOptions,
  })
}

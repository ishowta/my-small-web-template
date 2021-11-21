import { CollectionReference, DocumentData } from '@firebase/firestore'
import { useMemo } from 'react'
import { useCollectionData } from 'react-firebase-hooks/firestore'

const snapshotOptions = {
  serverTimestamps: 'estimate',
} as const

export const useCollection = <T extends DocumentData>(
  colRef: CollectionReference<T> | undefined
) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const innerColRef = useMemo(() => colRef, [colRef?.path])
  return useCollectionData<T, 'id', 'ref'>(innerColRef, {
    idField: 'id',
    refField: 'ref',
    snapshotOptions,
  })
}

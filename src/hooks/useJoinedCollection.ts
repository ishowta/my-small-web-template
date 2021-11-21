/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  FirestoreError,
  onSnapshot,
  Query,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

export type ExistSnapshot<T> = Omit<DocumentSnapshot<T>, 'data'> & {
  exists: true
  data: (options?: SnapshotOptions | undefined) => T
}

type MergeTuple<T extends Record<string, unknown>[]> = T extends []
  ? Record<string, never>
  : T extends [infer U, ...infer V]
  ? V extends Record<string, unknown>[] | []
    ? U & MergeTuple<V>
    : never
  : T extends (infer U)[]
  ? U extends Record<string, unknown>
    ? U
    : never
  : never

type TempDocumentSnapshots<T extends DocumentData[]> = {
  [P in keyof T]: DocumentSnapshot<T[P]>
}

type DocumentSnapshots<T extends DocumentData[]> = {
  [P in keyof T]: ExistSnapshot<T[P]>
}

type Selectors<Base extends DocumentData, T extends DocumentData[]> = {
  [P in keyof T]: (doc: QueryDocumentSnapshot<Base>) => DocumentReference<T[P]>
}

type JoinedSingleSnapshot<
  Base extends DocumentData,
  Joined extends DocumentData
> = {
  baseSnapshot: QueryDocumentSnapshot<Base>
  joinedSnapshot: ExistSnapshot<Joined>
  data: Base & Joined
}

export type JoinedMultiSnapshot<
  Base extends DocumentData,
  Joined extends DocumentData[]
> = {
  baseSnapshot: QueryDocumentSnapshot<Base>
  joinedSnapshots: DocumentSnapshots<Joined>
  data: MergeTuple<[Base, ...Joined]>
}

export type JoinedSnapshot<
  Base extends DocumentData,
  Joined extends DocumentData | DocumentData[]
> = Joined extends DocumentData[]
  ? JoinedMultiSnapshot<Base, Joined>
  : JoinedSingleSnapshot<Base, Joined>

const onJoinedSingleSnapshot = <
  Base extends DocumentData,
  Joined extends DocumentData
>(
  baseQuery: Query<Base>,
  selector: (doc: QueryDocumentSnapshot<Base>) => DocumentReference<Joined>,
  onNext: (snapshot: JoinedSingleSnapshot<Base, Joined>[]) => void,
  onError: (error: FirestoreError) => void,
  merge?: (
    snapshots: Omit<JoinedSingleSnapshot<Base, Joined>, 'data'>
  ) => JoinedSingleSnapshot<Base, Joined>['data']
) => {
  //console.log('single join', baseQuery)
  const docsData: {
    path: string
    unsub?: () => void
    result?: Omit<JoinedSingleSnapshot<Base, Joined>, 'joinedSnapshot'> & {
      joinedSnapshot: DocumentSnapshot<Joined>
    }
    exists?: boolean
  }[] = []
  let docsSize: number | undefined
  const unsub = onSnapshot(
    baseQuery,
    async (snapshot) => {
      //console.log('snap', snapshot)
      docsSize = snapshot.size
      if (snapshot.empty) {
        onNext([])
      }

      snapshot.docChanges().map((change) => {
        switch (change.type) {
          case 'added':
          case 'modified': {
            const docRef = selector(change.doc)
            let docData = docsData.find(
              (docData) => docData.path === change.doc.ref.path
            )
            if (docData == null) {
              docsData.push({ path: change.doc.ref.path })
              docData = docsData[docsData.length - 1]
            }

            //console.log('add/mod docdata', docData, docRef)
            docData.unsub?.()
            docData.unsub = onSnapshot(
              docRef,
              (snapshot) => {
                if (!docData) {
                  throw new Error('Failed to unsubscribe snapshot listener')
                }

                if (!snapshot.exists) {
                  docData.exists = false
                }

                docData.result = {
                  baseSnapshot: change.doc,
                  joinedSnapshot: snapshot as ExistSnapshot<Joined>,
                  data: merge
                    ? merge({
                        baseSnapshot: change.doc,
                        joinedSnapshot: snapshot as ExistSnapshot<Joined>,
                      })
                    : {
                        ...snapshot.data()!,
                        ...change.doc.data(),
                      },
                }

                //console.log('fetch join', snapshot, docData)

                if (
                  docsData.length === docsSize &&
                  docsData.every((docData) => docData.result)
                ) {
                  //console.log('fire onnext')
                  onNext(
                    docsData
                      .filter(
                        (docData) =>
                          docData.exists == null || docData.exists === true
                      )
                      .map(
                        (docData) =>
                          docData.result as JoinedSingleSnapshot<Base, Joined>
                      )
                  )
                }
              },
              (error) => {
                console.error('firestore joined error', docRef.path, docData)
                onError && onError(error)
              }
            )
            break
          }

          case 'removed': {
            const docDataIndex = docsData.findIndex(
              (docData) => docData.path === change.doc.ref.path
            )
            if (docDataIndex != null) {
              docsData[docDataIndex].unsub?.()
              docsData.splice(docDataIndex, 1)
              onNext(
                docsData
                  .filter(
                    (docData) =>
                      docData.exists == null || docData.exists === true
                  )
                  .map(
                    (docData) =>
                      docData.result as JoinedSingleSnapshot<Base, Joined>
                  )
              )
            }

            break
          }
        }
      })
    },
    (error) => {
      console.error(
        'firestore base error',
        'path' in baseQuery ? (baseQuery as any).path : baseQuery
      )
      onError && onError(error)
    }
  )
  return () => {
    docsData.forEach((docData) => docData.unsub?.())
    unsub()
  }
}

const onJoinedMultiSnapshot = <
  Base extends DocumentData,
  Joined extends [DocumentData, ...DocumentData[]]
>(
  baseQuery: Query<Base>,
  selectors: Selectors<Base, Joined>,
  onNext: (snapshot: JoinedMultiSnapshot<Base, Joined>[]) => void,
  onError: (error: FirestoreError) => void,
  merge?: (
    snapshots: Omit<JoinedMultiSnapshot<Base, Joined>, 'data'>
  ) => JoinedMultiSnapshot<Base, Joined>['data']
) => {
  //console.log('multi join', baseQuery)
  const docsData: {
    path: string
    recursiveUnsubscriber: (() => void)[]
    tempSnapshots: Partial<TempDocumentSnapshots<Joined>>
    result?: Omit<JoinedMultiSnapshot<Base, Joined>, 'joinedSnapshots'> & {
      joinedSnapshots: TempDocumentSnapshots<Joined>
    }
    exists?: boolean
  }[] = []
  let docsSize: number | undefined
  const joinSize = selectors.length
  const unsub = onSnapshot(
    baseQuery,
    async (snapshot) => {
      docsSize = snapshot.size
      if (snapshot.empty) {
        onNext([])
      }

      snapshot.docChanges().map((change) => {
        switch (change.type) {
          case 'added':
          case 'modified': {
            const docRefs = selectors.map((selector) => selector(change.doc))

            let docData = docsData.find(
              (docData) => docData.path === change.doc.ref.path
            )
            if (docData == null) {
              docsData.push({
                path: change.doc.ref.path,
                tempSnapshots: new Array(joinSize).fill(undefined) as Partial<
                  TempDocumentSnapshots<Joined>
                >,
                recursiveUnsubscriber: [],
              })
              docData = docsData[docsData.length - 1]
            }

            //console.log('mul: add/mod docdata', docData)
            docData.recursiveUnsubscriber.forEach((unsub) => unsub())
            docData.recursiveUnsubscriber = docRefs.map((docRef, docRefIndex) =>
              onSnapshot(
                docRef,
                (snapshot) => {
                  if (!docData) {
                    throw new Error('Failed to unsubscribe snapshot listener')
                  }

                  if (!snapshot.exists) {
                    docData.exists = false
                  }

                  docData.tempSnapshots[docRefIndex] = snapshot
                  /*console.log(
                      'mul: fetch join',
                      docRefIndex,
                      snapshot,
                      docData
                    )*/
                  if (
                    docData.tempSnapshots.every((snapshot) => snapshot != null)
                  ) {
                    const resultSnapshots =
                      docData.tempSnapshots as TempDocumentSnapshots<Joined>
                    docData.result = {
                      baseSnapshot: change.doc,
                      joinedSnapshots: resultSnapshots,
                      data:
                        merge && docData.exists // 存在しないデータは返らないので、マージ関数に渡したくない。あまりキレイなコードではないのであとでリファクタリングする
                          ? merge({
                              baseSnapshot: change.doc,
                              joinedSnapshots:
                                resultSnapshots as DocumentSnapshots<Joined>,
                            })
                          : ({
                              ...resultSnapshots
                                .map((snapshot) => snapshot.data())
                                .reverse()
                                .reduce(
                                  (merged, snapshot) => ({
                                    ...merged,
                                    ...snapshot,
                                  }),
                                  {}
                                ),
                              ...change.doc.data(),
                            } as JoinedMultiSnapshot<Base, Joined>['data']),
                    }
                    //console.log('mul: complete result', docRefIndex, docData)

                    if (
                      docsData.length === docsSize &&
                      docsData.every((docData) => docData.result)
                    ) {
                      //console.log('mul: fire onnext')
                      onNext(
                        docsData
                          .filter(
                            (docData) =>
                              docData.exists == null || docData.exists === true
                          )
                          .map(
                            (docData) =>
                              docData.result as JoinedMultiSnapshot<
                                Base,
                                Joined
                              >
                          )
                      )
                    }
                  }
                },
                (error) => {
                  console.error('firestore joined error', docRef.path, docData)
                  onError && onError(error)
                }
              )
            )

            break
          }

          case 'removed': {
            const docDataIndex = docsData.findIndex(
              (docData) => docData.path === change.doc.ref.path
            )
            /*console.log(
              'mul: removed',
              docsData.map((doc) => doc.id),
              change.doc.ref.id,
              docDataIndex
            )*/
            if (docDataIndex !== -1) {
              docsData[docDataIndex].recursiveUnsubscriber.forEach((unsub) =>
                unsub()
              )
              docsData.splice(docDataIndex, 1)
              onNext(
                docsData
                  .filter(
                    (docData) =>
                      docData.exists == null || docData.exists === true
                  )
                  .map(
                    (docData) =>
                      docData.result as JoinedMultiSnapshot<Base, Joined>
                  )
              )
            }

            break
          }
        }
      })
    },
    (error) => {
      console.error(
        'firestore base error',
        'path' in baseQuery ? (baseQuery as any).path : baseQuery
      )
      onError && onError(error)
    }
  )
  return () => {
    docsData.forEach((docData) =>
      docData.recursiveUnsubscriber.forEach((unsub) => unsub())
    )
    unsub()
  }
}

/**
 * コレクションから、各ドキュメントのref属性又はcustomSelectorを通して得られたrefを読んでjoinを行う
 *
 * アイテムが追加もしくは削除されたときに更新される。
 *
 * join先のデータが変更されても更新されない。
 * @param baseQuery
 * @param selector
 * @param onNext
 * @param onError
 * @param merge
 * @returns joinされたドキュメントのリスト
 */
export const onJoinedSnapshot = <
  Base extends DocumentData,
  Joined extends DocumentData | DocumentData[]
>(
  baseQuery: Query<Base>,
  selector: Joined extends DocumentData[]
    ? Selectors<Base, Joined>
    : (doc: QueryDocumentSnapshot<Base>) => DocumentReference<Joined>,
  onNext: (snapshot: JoinedSnapshot<Base, Joined>[]) => void,
  onError: (error: FirestoreError) => void,
  merge?: (
    snapshots: Omit<JoinedSnapshot<Base, Joined>, 'data'>
  ) => JoinedSnapshot<Base, Joined>['data']
) => {
  if (Array.isArray(selector)) {
    return onJoinedMultiSnapshot(
      baseQuery,
      selector as any,
      onNext as any,
      onError,
      merge as any
    )
  } else {
    return onJoinedSingleSnapshot(
      baseQuery,
      selector as any,
      onNext as any,
      onError,
      merge as any
    )
  }
}

export const useJoinedCollection = <
  Base extends DocumentData,
  Joined extends DocumentData | DocumentData[]
>(
  baseQuery: Query<Base> | undefined,
  selector: Joined extends DocumentData[]
    ? Selectors<Base, Joined>
    : (doc: QueryDocumentSnapshot<Base>) => DocumentReference<Joined>,
  merge?: (
    snapshots: Omit<JoinedSnapshot<Base, Joined>, 'data'>
  ) => JoinedSnapshot<Base, Joined>['data']
): [
  JoinedSnapshot<Base, Joined>[] | undefined,
  boolean,
  FirestoreError | undefined
] => {
  const [value, setValue] = useState<JoinedSnapshot<Base, Joined>[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<FirestoreError>()

  useEffect(() => {
    setLoading(true)
    if (baseQuery) {
      const unsub = onJoinedSnapshot(
        baseQuery,
        selector,
        (snapshot) => {
          setValue(snapshot)
          setLoading(false)
        },
        (error) => {
          setError(error)
          console.warn('useJoinedCollectionError:', error, baseQuery)
        },
        merge
      )
      return () => {
        unsub()
        setValue([])
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseQuery])

  return [value, loading, error]
}

export const useWithSoftDelete = <
  Base extends DocumentData,
  Joined extends
    | (DocumentData & { deleted: boolean })
    | [DocumentData & { deleted: boolean }, ...DocumentData[]]
>(
  props: [
    JoinedSnapshot<Base, Joined>[] | undefined,
    boolean,
    FirestoreError | undefined
  ]
): [
  JoinedSnapshot<Base, Joined>[] | undefined,
  boolean,
  FirestoreError | undefined
] => {
  const [value, loading, error] = props
  const [filteredValue, setFilteredValue] = useState(value)
  useEffect(() => {
    setFilteredValue(value?.filter((room) => !room.data.deleted))
  }, [value])
  return [filteredValue, loading, error]
}

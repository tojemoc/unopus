import type { MediaObject } from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import type { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import type {
	PeripheralDevicePubSubCollections,
	PeripheralDevicePubSubTypes
} from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'

/** Sofie Core publication / minimongo collection for studio media objects. */
export const MEDIA_OBJECTS_PUBLICATION = 'mediaObjects' as const
export const MEDIA_OBJECTS_COLLECTION = 'mediaObjects' as const

export type CoreMediaPubSubTypes = PeripheralDevicePubSubTypes & {
	[MEDIA_OBJECTS_PUBLICATION]: (
		deviceId: PeripheralDeviceId,
		token?: string
	) => typeof MEDIA_OBJECTS_COLLECTION
}

export type CoreMediaPubSubCollections = PeripheralDevicePubSubCollections & {
	[MEDIA_OBJECTS_COLLECTION]: MediaObject
}

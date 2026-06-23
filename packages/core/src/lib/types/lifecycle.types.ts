/**
 * Duck-typed lifecycle hooks. A provider instance exposing these methods has them
 * invoked by the container: `onInit` after its dependencies are ready, `onDestroy`
 * (in reverse construction order) when the container is disposed.
 */
export interface OnInit {
	onInit(): void | Promise<void>;
}

export interface OnDestroy {
	onDestroy(): void | Promise<void>;
}

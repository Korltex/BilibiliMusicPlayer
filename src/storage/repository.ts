import {
  GM_addValueChangeListener,
  GM_getValue,
  GM_removeValueChangeListener,
  GM_setValue,
} from "$";
import type { AppData } from "../core/types";
import { migrateAppData, STORAGE_KEY } from "./schema";

type DataListener = (data: AppData) => void;

export class AppRepository {
  load(): AppData {
    return migrateAppData(GM_getValue<unknown>(STORAGE_KEY));
  }

  save(data: AppData): void {
    GM_setValue(STORAGE_KEY, data);
  }

  subscribe(listener: DataListener): () => void {
    const listenerId = GM_addValueChangeListener(
      STORAGE_KEY,
      (
        _key: string,
        _oldValue?: unknown,
        newValue?: unknown,
        remote?: boolean,
      ) => {
        if (remote) {
          listener(migrateAppData(newValue));
        }
      },
    );

    return () => GM_removeValueChangeListener(listenerId);
  }
}

import { selection } from '$lib/logic/selection';
import { fileStateCollection } from '$lib/logic/file-state';
import { settings } from '$lib/logic/settings';
import { buildGPX, type GPXFile } from 'gpx';
import FileSaver from 'file-saver';
import JSZip from 'jszip';
import { get } from 'svelte/store';

export enum ExportState {
    NONE,
    SELECTION,
    ALL,
}
export const exportState = $state({
    current: ExportState.NONE,
});

async function exportFiles(fileIds: string[], exclude: string[]) {
    if (fileIds.length > 1) {
        await exportFilesAsZip(fileIds, exclude);
    } else {
        const firstFileId = fileIds.at(0);
        if (firstFileId != null) {
            const file = fileStateCollection.getFile(firstFileId);
            if (file) {
                await exportFile(file, exclude);
            }
        }
    }
}

export async function exportSelectedFiles(exclude: string[]) {
    const fileIds: string[] = [];
    selection.applyToOrderedSelectedItemsFromFile(async (fileId, level, items) => {
        fileIds.push(fileId);
    });
    await exportFiles(fileIds, exclude);
}

export async function exportAllFiles(exclude: string[]) {
    await exportFiles(get(settings.fileOrder), exclude);
}

async function exportFile(file: GPXFile, exclude: string[]) {
    const gpxText = buildGPX(file, exclude);

    // Bridge-Mode: wenn save_url als URL-Param gesetzt ist, POST an die URL
    // und danach zu return_url navigieren. Fuer externe Tools wie conciergeOS,
    // die die bearbeitete GPX direkt empfangen wollen statt ueber den
    // lokalen Download-Umweg.
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const saveUrl = params.get('save_url');
        const returnUrl = params.get('return_url');
        if (saveUrl) {
            try {
                const res = await fetch(saveUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/gpx+xml' },
                    body: gpxText,
                });
                if (res.ok) {
                    if (returnUrl) {
                        window.location.href = returnUrl;
                    }
                    return;
                }
                console.error('Bridge save failed', res.status, await res.text());
                alert(
                    'Speichern an externe URL fehlgeschlagen. GPX wird stattdessen lokal heruntergeladen.'
                );
            } catch (e) {
                console.error('Bridge save error', e);
                alert(
                    'Speichern an externe URL fehlgeschlagen (Netzwerk). GPX wird stattdessen lokal heruntergeladen.'
                );
            }
        }
    }

    const blob = new Blob([gpxText], { type: 'application/gpx+xml' });
    FileSaver.saveAs(blob, `${file.metadata.name}.gpx`);
}

async function exportFilesAsZip(fileIds: string[], exclude: string[]) {
    const zip = new JSZip();
    for (const fileId of fileIds) {
        const file = fileStateCollection.getFile(fileId);
        if (file) {
            const gpx = buildGPX(file, exclude);
            let filename = file.metadata.name;
            for (let i = 1; zip.files[filename + '.gpx']; i++) {
                filename = file.metadata.name + `-${i}`;
            }
            zip.file(filename + '.gpx', gpx);
        }
    }
    if (Object.keys(zip.files).length > 0) {
        const blob = await zip.generateAsync({ type: 'blob' });
        FileSaver.saveAs(blob, 'gpx-files.zip');
    }
}

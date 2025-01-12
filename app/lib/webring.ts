import fs from 'fs/promises';
import path from 'path';

export type WebringEntry = {
    name: string;
    url: string;
    imageFile?: string;
};

const PINNED = ['alula'];

export async function getWebring(): Promise<WebringEntry[]> {
    const webringSrcPath = path.join(process.cwd(), 'app/webring');
    const entries = await fs.readdir(webringSrcPath, { withFileTypes: true });
    
    const webring = await Promise.all(
        entries
            .filter(entry => entry.isDirectory())
            .map(async (entry) => {
                const metaPath = path.join(webringSrcPath, entry.name, 'meta.json');
                const metaContent = await fs.readFile(metaPath, 'utf-8');
                return JSON.parse(metaContent) as WebringEntry;
            })
    );
    
    return [
        ...webring.filter(entry => PINNED.includes(entry.name)),
        ...webring
            .filter(entry => !PINNED.includes(entry.name))
            .sort((a, b) => a.name.localeCompare(b.name))
    ];
}

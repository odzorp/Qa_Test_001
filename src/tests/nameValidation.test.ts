import { normalizeName } from '../server';
import path from 'path';
import { promises as fs } from 'fs';

describe('Name Validation', () => {
    let users: string[];

    // Load actual users from JSON before tests
    beforeAll(async () => {
        const usersPath = path.resolve(__dirname, '../../data/users.json');
        const raw = await fs.readFile(usersPath, 'utf8');
        users = JSON.parse(raw);
    });

    test('should handle all users from users.json', () => {
        users.forEach(name => {
            const normalized = normalizeName(name);
            expect(normalized).toBeDefined();
            expect(typeof normalized).toBe('string');
            expect(normalized.length).toBeGreaterThan(0);
        });
    });

    test('should handle names with apostrophes', () => {
        const namesWithApostrophes = [
            "Luc O'Connor",
            "Sara O'Malley",
            "Renee O'Connor",
            "T'Challa Udaku"
        ];

        namesWithApostrophes.forEach(name => {
            const normalized = normalizeName(name);
            expect(normalized).toContain("'");
            expect(normalized).toBe(name);
        });
    });

    test('should handle names with diacritics', () => {
        const input = "María López";
        const expected = "Maria Lopez";
        expect(normalizeName(input)).toBe(expected);
    });

// Preventive test for future data quality
    test('should trim and normalize whitespace', () => {
        const testCases = [
            ["  Aminah   Bello  ", "Aminah Bello"],
            ["Noah    Johnson", "Noah Johnson"],
            [" Chidera    Obi ", "Chidera Obi"]
        ];

        testCases.forEach(([input, expected]) => {
            expect(normalizeName(input)).toBe(expected);
        });
    });
});
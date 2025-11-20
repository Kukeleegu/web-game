// Global type declarations for custom window properties

declare global {
    interface Window {
        WEAPONS: {
            [key: string]: any;
        };
        Weapon: any;
        WeaponFactory: any;
    }
}

export {};

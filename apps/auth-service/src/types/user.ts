export type User = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    password_hash: string;
    created_at: Date;
};

export type UserRole = "USER" | "ADMIN";
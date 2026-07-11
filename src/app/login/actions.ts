"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function readRequiredField(
  formData: FormData,
  fieldName: string,
) {
  const value = formData.get(fieldName);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function redirectToLoginError(
  message: string,
): never {
  redirect(
    `/login?error=${encodeURIComponent(message)}`,
  );
}

function validateCredentials(
  email: string,
  password: string,
) {
  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    redirectToLoginError(
      "Enter a valid email address.",
    );
  }

  if (password.length < 8) {
    redirectToLoginError(
      "Your password must contain at least 8 characters.",
    );
  }
}

export async function login(
  formData: FormData,
) {
  const email = readRequiredField(
    formData,
    "email",
  ).toLowerCase();

  const password = readRequiredField(
    formData,
    "password",
  );

  validateCredentials(email, password);

  const supabase = await createClient();

  const { error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    redirectToLoginError(error.message);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(
  formData: FormData,
) {
  const email = readRequiredField(
    formData,
    "email",
  ).toLowerCase();

  const password = readRequiredField(
    formData,
    "password",
  );

  validateCredentials(email, password);

  const headerStore = await headers();

  const origin =
    headerStore.get("origin") ??
    "http://localhost:3000";

  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          `${origin}/auth/callback`,
      },
    });

  if (error) {
    redirectToLoginError(error.message);
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/");
  }

  redirect("/auth/check-email");
}

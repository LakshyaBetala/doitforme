import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Ignored
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Ignored
          }
        },
      },
    }
  )

  const { gigId, rating, review } = await request.json();

  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Get Gig Data
  const { data: gig, error: gigError } = await supabase
    .from("gigs")
    .select("assigned_worker_id, price")
    .eq("id", gigId)
    .single();

  if (gigError || !gig) return NextResponse.json({ error: "Gig not found" }, { status: 404 });

  // 3. Update Gig Status
  const { error: updateError } = await supabase
    .from("gigs")
    .update({ 
      status: "COMPLETED", 
      rating: rating, 
      review: review 
    })
    .eq("id", gigId);

  if (updateError) return NextResponse.json({ error: "Failed to update gig" }, { status: 500 });

  // 4. Update Worker Stats (The Fix for 0 Ratings)
  if (gig.assigned_worker_id) {
    const { data: worker } = await supabase
      .from("users")
      .select("rating, rating_count, total_earned")
      .eq("id", gig.assigned_worker_id)
      .single();

    const oldRating = Number(worker?.rating) || 5.0; // Default to 5.0 if new
    const oldCount = Number(worker?.rating_count) || 0;
    const currentEarned = Number(worker?.total_earned) || 0;

    // Weighted Average Calculation
    const newCount = oldCount + 1;
    const newRating = ((oldRating * oldCount) + Number(rating)) / newCount;

    await supabase
      .from("users")
      .update({
        rating: newRating,
        rating_count: newCount,
        total_earned: currentEarned + gig.price
      })
      .eq("id", gig.assigned_worker_id);
  }

  return NextResponse.json({ success: true });
}


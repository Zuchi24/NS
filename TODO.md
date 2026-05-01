# TODO - Student Side View for Learning Materials

## Task

Modify the "Learning Materials" section so this page functions as the Student Side View only.

## Plan Steps

### Step 1: Add role-based logic to TopicDetailsPage.tsx

- [x] Add const userRole = "student"; at component level
- [x] Add comments for future Firebase/Supabase/JWT integration
- [x] Conditionally render upload placeholder only for admin
- [x] Show "No learning materials uploaded yet." for students when no files exist

### Step 2: Test and verify

- [x] Verify the rendering works correctly for student role
- [x] Verify admin-only features are hidden for students

## Status: COMPLETED

# Simple VoxCity Deployment: Just Commit It

## The Honest Truth

**Your instinct is right.** For this use case, just generating locally and committing is simpler:

## ✅ Option A: Generate & Commit (RECOMMENDED)

```bash
# 1. Generate the data locally
npm run generate-voxcity

# 2. Remove from .gitignore  
sed -i '' '/\/public\/vox\//d' .gitignore

# 3. Add to git
git add public/vox/
git commit -m "Add precomputed VoxCity shadow data"
git push

# Done! ✅
```

**Pros:**
- ✅ **Blazing fast deployments** (no 2-3min generation)
- ✅ **Bulletproof** - no risk of build failures
- ✅ **Simple** - just static files
- ✅ **Deterministic** - same data every deployment
- ✅ **Easy debugging** - can inspect the generated files

**Cons:**
- ❌ Repo size: 3MB → 28MB (still tiny by GitHub standards)
- ❌ Need to regenerate manually if algorithm changes
- ❌ "Generated files in git" (some devs don't like this)

## ❓ Option B: Build-Time Generation 

**Pros:**
- ✅ Cleaner repo (no generated files)
- ✅ Always uses latest generation logic

**Cons:**
- ❌ **Slower deployments** (+2-3 minutes every time)
- ❌ **Complex** - can fail during build
- ❌ **Wasteful** - regenerates same data repeatedly
- ❌ **Risk** - if generation fails, deployment fails

## Reality Check

**Your VoxCity data:**
- Size: 25MB (6,343 files)
- Changes: Rarely (shadow patterns are physics)
- Generation time: ~2-3 minutes
- Stability: Very stable once generated

**GitHub limits:**
- Your repo: 28MB total with VoxCity
- GitHub warning: 1GB (you're at 2.8%)
- GitHub limit: 100GB (you're at 0.028%)

## Recommendation: Just Commit It

For **shadow mask data specifically**, committing makes sense because:

1. **Physics doesn't change** - shadow patterns are stable
2. **Small dataset** - 25MB is nothing in 2024
3. **Critical for app** - you want guaranteed availability
4. **Saves 2-3min per deployment** - adds up quickly

## When NOT to commit generated files

- Large datasets (>100MB)
- Frequently changing data
- User-specific data
- Build artifacts that change often

## Your case: Perfect for committing! ✅

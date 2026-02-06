"""Learning demo — demonstrates the self-improvement cycle."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.adaptive_pfc import AdaptivePFC

DEMO_QUESTIONS = [
    "How do you interpret effect sizes in meta-analysis?",
    "What's the difference between correlation and causation?",
    "How do you detect publication bias in a meta-analysis?",
    "When should you use fixed effects vs random effects?",
    "What are Bradford Hill criteria for causation?",
    "How do you calculate statistical power?",
    "What's heterogeneity in meta-analysis?",
    "How do you do Bayesian updating?",
    "What's the difference between frequentist and Bayesian stats?",
    "How do you handle confounding variables?",
]


def run_learning_demo():
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("LEARNING CYCLE DEMO")
    print("=" * 60)

    pfc = AdaptivePFC()

    for i, question in enumerate(DEMO_QUESTIONS, 1):
        print(f"\n[{i}/{len(DEMO_QUESTIONS)}] {question}")
        try:
            result = pfc.process(question)
            snippet = result.response[:120] if hasattr(result, "response") else str(result)[:120]
            print(f"  -> {snippet}...")
        except Exception as e:
            print(f"  ERROR: {e}")

    print("\n" + "=" * 60)
    print("TRIGGERING LEARNING CYCLE")
    print("=" * 60)

    learn_result = pfc.trigger_learning_now()
    print(learn_result.get("message", "Done."))

    skills = pfc.list_learned_skills()
    print(f"\nLearned skills: {skills.get('count', 0)}")
    for name in skills.get("skills", []):
        detail = skills.get("details", {}).get(name, {})
        print(f"  - {name} (mastery {detail.get('mastery_level', 0):.2f})")

    print("\nLearning cycle complete.\n")


if __name__ == "__main__":
    run_learning_demo()

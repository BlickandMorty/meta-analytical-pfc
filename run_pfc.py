"""Interactive CLI for the Meta-Analytical PFC."""

import argparse
from src.core.adaptive_pfc import AdaptivePFC


def main():
    parser = argparse.ArgumentParser(description="Meta-Analytical PFC")
    parser.add_argument("--domain", default="auto", help="Domain routing (auto|research|legal|strategy)")
    parser.add_argument("--user-id", default=None, help="Optional user id for memory scoping")
    args = parser.parse_args()

    pfc = AdaptivePFC()
    print("Meta-Analytical PFC ready. Commands: :learn, :skills, exit")

    while True:
        try:
            query = input("\nQUERY: ").strip()
            if query.lower() in ("exit", "quit", "q"):
                break
            if not query:
                continue

            if query.lower() in (":learn", "/learn"):
                result = pfc.trigger_learning_now()
                print(f"\n{result.get('message', 'Learning cycle complete.')}")
                continue

            if query.lower() in (":skills", "/skills"):
                result = pfc.list_learned_skills()
                if result.get("count", 0) == 0:
                    print("\nNo learned skills yet. Run complex queries, then :learn.")
                else:
                    print("\nLEARNED SKILLS:")
                    for name in result.get("skills", []):
                        detail = result.get("details", {}).get(name, {})
                        mastery = detail.get("mastery_level", 0.0)
                        desc = detail.get("description", "")
                        line = f"  {name} (mastery {mastery:.2f})"
                        if desc:
                            line += f": {desc}"
                        print(line)
                continue

            result = pfc.process(query, domain=args.domain, user_id=args.user_id)
            if isinstance(result, dict) and result.get("error"):
                print(result)
                continue

            print(f"\nANSWER:\n{result.response}")
            print(f"\nConfidence: {result.confidence:.2f}")
        except KeyboardInterrupt:
            break

    print("\nDone.")


if __name__ == "__main__":
    main()

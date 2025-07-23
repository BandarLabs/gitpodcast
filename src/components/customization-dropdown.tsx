import { useState } from "react";
import { CopyButton } from "./copy-button";
import { Wand2, RefreshCw, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { ActionButton } from "./action-button";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface CustomizationDropdownProps {
  onModify: (instructions: string) => void;
  onRegenerate: (instructions: string) => void;
  onCopy: () => void;
  lastGenerated: Date;
  language: string;
  onLanguageChange: (language: string) => void;
}

export function CustomizationDropdown({
  onModify,
  onRegenerate,
  onCopy,
  lastGenerated,
  language,
  onLanguageChange,
}: CustomizationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [instructions, setInstructions] = useState("");

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <div className="mt-4 w-full">
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-md border-[3px] border-black bg-purple-300 px-4 py-2 font-medium text-black transition-colors hover:bg-purple-400"
      >
        <span>Customize Diagram</span>
        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>

      <div className="relative">
        <div
          className={`transition-all duration-200 ${
            isOpen
              ? "pointer-events-auto mt-4 max-h-[500px] opacity-100"
              : "pointer-events-none max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <Textarea
                placeholder="Custom instructions (optional)"
                className="min-h-[38px] flex-1 resize-y rounded-md border-[3px] border-black px-3 py-2 text-base font-bold shadow-[4px_4px_0_0_#000000] placeholder:text-base placeholder:font-normal placeholder:text-gray-700 sm:min-h-[46px] sm:px-4 sm:py-3 sm:text-lg sm:placeholder:text-lg"
                value={instructions}
                onChange={(e) => {
                  if (e.target.value.length <= 1000) {
                    setInstructions(e.target.value);
                  }
                }}
                maxLength={1000}
                rows={1}
              />

              <div className="flex flex-row gap-3 sm:gap-4">
                <ActionButton
                  onClick={() => onModify(instructions)}
                  icon={Wand2}
                  tooltipText="Modify existing diagram"
                  disabled={!instructions.trim()}
                />

                <ActionButton
                  onClick={() => onRegenerate(instructions)}
                  icon={RefreshCw}
                  tooltipText="Regenerate with/without custom instructions"
                />

                <CopyButton onClick={onCopy} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">
                Last generated: {lastGenerated.toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-gray-700" />
                <Select value={language} onValueChange={onLanguageChange}>
                  <SelectTrigger className="h-8 w-[120px] border-2 border-black text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

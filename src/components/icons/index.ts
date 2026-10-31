'use client';

import { faFileArrowDown } from '@fortawesome/free-solid-svg-icons/faFileArrowDown';
import { faBox } from '@fortawesome/free-solid-svg-icons/faBox';
import { faHeartPulse } from '@fortawesome/free-solid-svg-icons/faHeartPulse';
import { faListOl } from '@fortawesome/free-solid-svg-icons/faListOl';

import {
  ArrowDown as LucideArrowDown,
  ArrowDownToDot as LucideArrowDownToDot,
  ArrowDownUp as LucideArrowDownUp,
  ArrowLeft as LucideArrowLeft,
  ArrowLeftRight as LucideArrowLeftRight,
  ArrowRight as LucideArrowRight,
  ArrowUp as LucideArrowUp,
  ArrowUpFromDot as LucideArrowUpFromDot,
  ArrowUpRight as LucideArrowUpRight,
  Check as LucideCheck,
  CheckCheck as LucideCheckCheck,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  ChevronUp as LucideChevronUp,
  ChevronsLeft as LucideChevronsLeft,
  ChevronsRight as LucideChevronsRight,
  ChevronsUp as LucideChevronsUp,
  ChevronsUpDown as LucideChevronsUpDown,
  CircleDashed as LucideCircleDashed,
  CornerUpLeft as LucideCornerUpLeft,
  Ellipsis as LucideEllipsis,
  ExternalLink as LucideExternalLink,
  Flag as LucideFlag,
  FoldVertical as LucideFoldVertical,
  LoaderCircle as LucideLoaderCircle,
  Maximize as LucideMaximize,
  Minimize as LucideMinimize,
  Minus as LucideMinus,
  MoveHorizontal as LucideMoveHorizontal,
  PanelLeft as LucidePanelLeft,
  PanelLeftClose as LucidePanelLeftClose,
  Plus as LucidePlus,
  RefreshCw as LucideRefreshCw,
  RotateCcw as LucideRotateCcw,
  RotateCw as LucideRotateCw,
  Square as LucideSquare,
  SquareX as LucideSquareX,
  Star as LucideStar,
  Undo2 as LucideUndo2,
  UnfoldHorizontal as LucideUnfoldHorizontal,
  UnfoldVertical as LucideUnfoldVertical,
  WifiOff as LucideWifiOff,
  X as LucideX,
  ZoomIn as LucideZoomIn,
  ZoomOut as LucideZoomOut,
} from 'lucide-react';
import { faAlignJustify } from '@fortawesome/free-solid-svg-icons/faAlignJustify';
import { faAlignLeft } from '@fortawesome/free-solid-svg-icons/faAlignLeft';
import { faAlignRight } from '@fortawesome/free-solid-svg-icons/faAlignRight';
import { faArrowDownAZ } from '@fortawesome/free-solid-svg-icons/faArrowDownAZ';
import { faArrowDownZA } from '@fortawesome/free-solid-svg-icons/faArrowDownZA';
import { faArrowUpFromBracket } from '@fortawesome/free-solid-svg-icons/faArrowUpFromBracket';
import { faAt } from '@fortawesome/free-solid-svg-icons/faAt';
import { faAtom } from '@fortawesome/free-solid-svg-icons/faAtom';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';
import { faBellSlash } from '@fortawesome/free-solid-svg-icons/faBellSlash';
import { faBinoculars } from '@fortawesome/free-solid-svg-icons/faBinoculars';
import { faBold } from '@fortawesome/free-solid-svg-icons/faBold';
import { faBolt } from '@fortawesome/free-solid-svg-icons/faBolt';
import { faBookOpen } from '@fortawesome/free-solid-svg-icons/faBookOpen';
import { faBookmark } from '@fortawesome/free-solid-svg-icons/faBookmark';
import { faBoxArchive } from '@fortawesome/free-solid-svg-icons/faBoxArchive';
import { faBrain } from '@fortawesome/free-solid-svg-icons/faBrain';
import { faBriefcase } from '@fortawesome/free-solid-svg-icons/faBriefcase';
import { faBuilding } from '@fortawesome/free-solid-svg-icons/faBuilding';
import { faBullhorn } from '@fortawesome/free-solid-svg-icons/faBullhorn';
import { faBullseye } from '@fortawesome/free-solid-svg-icons/faBullseye';
import { faCalendar } from '@fortawesome/free-solid-svg-icons/faCalendar';
import { faCalendarDays } from '@fortawesome/free-solid-svg-icons/faCalendarDays';
import { faCalendarPlus } from '@fortawesome/free-solid-svg-icons/faCalendarPlus';
import { faCalendarXmark } from '@fortawesome/free-solid-svg-icons/faCalendarXmark';
import { faCamera } from '@fortawesome/free-solid-svg-icons/faCamera';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons/faCaretDown';
import { faCaretLeft } from '@fortawesome/free-solid-svg-icons/faCaretLeft';
import { faCaretRight } from '@fortawesome/free-solid-svg-icons/faCaretRight';
import { faCaretUp } from '@fortawesome/free-solid-svg-icons/faCaretUp';
import { faCertificate } from '@fortawesome/free-solid-svg-icons/faCertificate';
import { faChalkboard } from '@fortawesome/free-solid-svg-icons/faChalkboard';
import { faChartColumn } from '@fortawesome/free-solid-svg-icons/faChartColumn';
import { faChartLine } from '@fortawesome/free-solid-svg-icons/faChartLine';
import { faChartPie } from '@fortawesome/free-solid-svg-icons/faChartPie';
import { faCircle } from '@fortawesome/free-solid-svg-icons/faCircle';
import { faCircleArrowUp } from '@fortawesome/free-solid-svg-icons/faCircleArrowUp';
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons/faCircleCheck';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons/faCircleExclamation';
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import { faCirclePlay } from '@fortawesome/free-solid-svg-icons/faCirclePlay';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons/faCirclePlus';
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons/faCircleQuestion';
import { faCircleStop } from '@fortawesome/free-solid-svg-icons/faCircleStop';
import { faCircleUser } from '@fortawesome/free-solid-svg-icons/faCircleUser';
import { faCircleXmark } from '@fortawesome/free-solid-svg-icons/faCircleXmark';
import { faClipboard } from '@fortawesome/free-solid-svg-icons/faClipboard';
import { faClipboardList } from '@fortawesome/free-solid-svg-icons/faClipboardList';
import { faClock } from '@fortawesome/free-solid-svg-icons/faClock';
import { faClockRotateLeft } from '@fortawesome/free-solid-svg-icons/faClockRotateLeft';
import { faClone } from '@fortawesome/free-solid-svg-icons/faClone';
import { faCode } from '@fortawesome/free-solid-svg-icons/faCode';
import { faCodeBranch } from '@fortawesome/free-solid-svg-icons/faCodeBranch';
import { faCodeCompare } from '@fortawesome/free-solid-svg-icons/faCodeCompare';
import { faCodeFork } from '@fortawesome/free-solid-svg-icons/faCodeFork';
import { faComment } from '@fortawesome/free-solid-svg-icons/faComment';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons/faCommentDots';
import { faComments } from '@fortawesome/free-solid-svg-icons/faComments';
import { faCopy } from '@fortawesome/free-solid-svg-icons/faCopy';
import { faCrosshairs } from '@fortawesome/free-solid-svg-icons/faCrosshairs';
import { faDatabase } from '@fortawesome/free-solid-svg-icons/faDatabase';
import { faDesktop } from '@fortawesome/free-solid-svg-icons/faDesktop';
import { faDiagramProject } from '@fortawesome/free-solid-svg-icons/faDiagramProject';
import { faDiceFive } from '@fortawesome/free-solid-svg-icons/faDiceFive';
import { faDoorOpen } from '@fortawesome/free-solid-svg-icons/faDoorOpen';
import { faDownload } from '@fortawesome/free-solid-svg-icons/faDownload';
import { faEnvelope } from '@fortawesome/free-solid-svg-icons/faEnvelope';
import { faEraser } from '@fortawesome/free-solid-svg-icons/faEraser';
import { faExpand } from '@fortawesome/free-solid-svg-icons/faExpand';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import { faFaceSmile } from '@fortawesome/free-solid-svg-icons/faFaceSmile';
import { faFaceSmileBeam } from '@fortawesome/free-solid-svg-icons/faFaceSmileBeam';
import { faFile } from '@fortawesome/free-solid-svg-icons/faFile';
import { faFileArrowUp } from '@fortawesome/free-solid-svg-icons/faFileArrowUp';
import { faFileCode } from '@fortawesome/free-solid-svg-icons/faFileCode';
import { faFileLines } from '@fortawesome/free-solid-svg-icons/faFileLines';
import { faFilePdf } from '@fortawesome/free-solid-svg-icons/faFilePdf';
import { faFilePen } from '@fortawesome/free-solid-svg-icons/faFilePen';
import { faFilter } from '@fortawesome/free-solid-svg-icons/faFilter';
import { faFingerprint } from '@fortawesome/free-solid-svg-icons/faFingerprint';
import { faFire } from '@fortawesome/free-solid-svg-icons/faFire';
import { faFlag } from '@fortawesome/free-solid-svg-icons/faFlag';
import { faFloppyDisk } from '@fortawesome/free-solid-svg-icons/faFloppyDisk';
import { faFolder } from '@fortawesome/free-solid-svg-icons/faFolder';
import { faFolderOpen } from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import { faFolderPlus } from '@fortawesome/free-solid-svg-icons/faFolderPlus';
import { faFont } from '@fortawesome/free-solid-svg-icons/faFont';
import { faForwardStep } from '@fortawesome/free-solid-svg-icons/faForwardStep';
import { faG } from '@fortawesome/free-solid-svg-icons/faG';
import { faGear } from '@fortawesome/free-solid-svg-icons/faGear';
import { faGlobe } from '@fortawesome/free-solid-svg-icons/faGlobe';
import { faGrip } from '@fortawesome/free-solid-svg-icons/faGrip';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons/faGripVertical';
import { faHand } from '@fortawesome/free-solid-svg-icons/faHand';
import { faHashtag } from '@fortawesome/free-solid-svg-icons/faHashtag';
import { faHeart } from '@fortawesome/free-solid-svg-icons/faHeart';
import { faHighlighter } from '@fortawesome/free-solid-svg-icons/faHighlighter';
import { faImage } from '@fortawesome/free-solid-svg-icons/faImage';
import { faInbox } from '@fortawesome/free-solid-svg-icons/faInbox';
import { faItalic } from '@fortawesome/free-solid-svg-icons/faItalic';
import { faKey } from '@fortawesome/free-solid-svg-icons/faKey';
import { faLanguage } from '@fortawesome/free-solid-svg-icons/faLanguage';
import { faLayerGroup } from '@fortawesome/free-solid-svg-icons/faLayerGroup';
import { faLeaf } from '@fortawesome/free-solid-svg-icons/faLeaf';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faLink } from '@fortawesome/free-solid-svg-icons/faLink';
import { faListCheck } from '@fortawesome/free-solid-svg-icons/faListCheck';
import { faListUl } from '@fortawesome/free-solid-svg-icons/faListUl';
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock';
import { faLockOpen } from '@fortawesome/free-solid-svg-icons/faLockOpen';
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons/faMagnifyingGlass';
import { faMicrophone } from '@fortawesome/free-solid-svg-icons/faMicrophone';
import { faMoon } from '@fortawesome/free-solid-svg-icons/faMoon';
import { faMugSaucer } from '@fortawesome/free-solid-svg-icons/faMugSaucer';
import { faObjectGroup } from '@fortawesome/free-solid-svg-icons/faObjectGroup';
import { faPaintbrush } from '@fortawesome/free-solid-svg-icons/faPaintbrush';
import { faPalette } from '@fortawesome/free-solid-svg-icons/faPalette';
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons/faPaperPlane';
import { faPaperclip } from '@fortawesome/free-solid-svg-icons/faPaperclip';
import { faPause } from '@fortawesome/free-solid-svg-icons/faPause';
import { faPen } from '@fortawesome/free-solid-svg-icons/faPen';
import { faPenNib } from '@fortawesome/free-solid-svg-icons/faPenNib';
import { faPenRuler } from '@fortawesome/free-solid-svg-icons/faPenRuler';
import { faPlay } from '@fortawesome/free-solid-svg-icons/faPlay';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faPlugCircleCheck } from '@fortawesome/free-solid-svg-icons/faPlugCircleCheck';
import { faPuzzlePiece } from '@fortawesome/free-solid-svg-icons/faPuzzlePiece';
import { faReceipt } from '@fortawesome/free-solid-svg-icons/faReceipt';
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons/faRightFromBracket';
import { faRightToBracket } from '@fortawesome/free-solid-svg-icons/faRightToBracket';
import { faRobot } from '@fortawesome/free-solid-svg-icons/faRobot';
import { faRocket } from '@fortawesome/free-solid-svg-icons/faRocket';
import { faRoute } from '@fortawesome/free-solid-svg-icons/faRoute';
import { faScroll } from '@fortawesome/free-solid-svg-icons/faScroll';
import { faShareNodes } from '@fortawesome/free-solid-svg-icons/faShareNodes';
import { faShieldHalved } from '@fortawesome/free-solid-svg-icons/faShieldHalved';
import { faSitemap } from '@fortawesome/free-solid-svg-icons/faSitemap';
import { faSliders } from '@fortawesome/free-solid-svg-icons/faSliders';
import { faSquareCaretRight } from '@fortawesome/free-solid-svg-icons/faSquareCaretRight';
import { faSquareCheck } from '@fortawesome/free-solid-svg-icons/faSquareCheck';
import { faSquareRootVariable } from '@fortawesome/free-solid-svg-icons/faSquareRootVariable';
import { faStar } from '@fortawesome/free-solid-svg-icons/faStar';
import { faStarHalfStroke } from '@fortawesome/free-solid-svg-icons/faStarHalfStroke';
import { faStop } from '@fortawesome/free-solid-svg-icons/faStop';
import { faStopwatch } from '@fortawesome/free-solid-svg-icons/faStopwatch';
import { faSun } from '@fortawesome/free-solid-svg-icons/faSun';
import { faT } from '@fortawesome/free-solid-svg-icons/faT';
import { faTable } from '@fortawesome/free-solid-svg-icons/faTable';
import { faTableCellsLarge } from '@fortawesome/free-solid-svg-icons/faTableCellsLarge';
import { faTableColumns } from '@fortawesome/free-solid-svg-icons/faTableColumns';
import { faTableList } from '@fortawesome/free-solid-svg-icons/faTableList';
import { faTag } from '@fortawesome/free-solid-svg-icons/faTag';
import { faTerminal } from '@fortawesome/free-solid-svg-icons/faTerminal';
import { faThumbtack } from '@fortawesome/free-solid-svg-icons/faThumbtack';
import { faThumbtackSlash } from '@fortawesome/free-solid-svg-icons/faThumbtackSlash';
import { faToolbox } from '@fortawesome/free-solid-svg-icons/faToolbox';
import { faTowerBroadcast } from '@fortawesome/free-solid-svg-icons/faTowerBroadcast';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons/faTrashCan';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import { faUpload } from '@fortawesome/free-solid-svg-icons/faUpload';
import { faUser } from '@fortawesome/free-solid-svg-icons/faUser';
import { faUserGroup } from '@fortawesome/free-solid-svg-icons/faUserGroup';
import { faUserMinus } from '@fortawesome/free-solid-svg-icons/faUserMinus';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons/faUserPlus';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons/faWandMagicSparkles';
import { faWaveSquare } from '@fortawesome/free-solid-svg-icons/faWaveSquare';
import { faWindowMaximize } from '@fortawesome/free-solid-svg-icons/faWindowMaximize';
import { faWindowRestore } from '@fortawesome/free-solid-svg-icons/faWindowRestore';
import { faWrench } from '@fortawesome/free-solid-svg-icons/faWrench';
import { solidIcon, outlineIcon } from './solid-icon';
import { ICON_SIZES } from './metrics';

// Shared FA7 Solid semantics; Lucide is limited to the documented outline controls.
export { ICON_SIZES };
export type { Icon, IconProps, Icon as LucideIcon } from './solid-icon';
export { Emoji } from './emoji';

export const SkillLayers = /* @__PURE__ */ solidIcon(faLayerGroup, 'SkillLayers');

export const FileArrowDown = /* @__PURE__ */ solidIcon(faFileArrowDown, 'FileArrowDown');
export const ListNumbers = /* @__PURE__ */ solidIcon(faListOl, 'ListNumbers');
export const Package = /* @__PURE__ */ solidIcon(faBox, 'Package');
export const Pulse = /* @__PURE__ */ solidIcon(faHeartPulse, 'Pulse');

export const Activity = /* @__PURE__ */ solidIcon(faWaveSquare, 'Activity');
export const Archive = /* @__PURE__ */ solidIcon(faBoxArchive, 'Archive');
export const ArrowBendUpLeft = /* @__PURE__ */ outlineIcon(LucideCornerUpLeft, 'ArrowBendUpLeft', 16);
export const ArrowClockwise = /* @__PURE__ */ outlineIcon(LucideRotateCw, 'ArrowClockwise', 16);
export const ArrowCounterClockwise = /* @__PURE__ */ outlineIcon(LucideRotateCcw, 'ArrowCounterClockwise', 16);
export const ArrowDown = /* @__PURE__ */ outlineIcon(LucideArrowDown, 'ArrowDown', 16);
export const ArrowDownAZ = /* @__PURE__ */ solidIcon(faArrowDownAZ, 'ArrowDownAZ');
export const ArrowDownToDot = /* @__PURE__ */ outlineIcon(LucideArrowDownToDot, 'ArrowDownToDot', 16);
export const ArrowDownZA = /* @__PURE__ */ solidIcon(faArrowDownZA, 'ArrowDownZA');
export const ArrowLeft = /* @__PURE__ */ outlineIcon(LucideArrowLeft, 'ArrowLeft', 16);
export const ArrowRight = /* @__PURE__ */ outlineIcon(LucideArrowRight, 'ArrowRight', 16);
export const ArrowSquareOut = /* @__PURE__ */ outlineIcon(LucideExternalLink, 'ArrowSquareOut', 14);
export const ArrowUUpLeft = /* @__PURE__ */ outlineIcon(LucideUndo2, 'ArrowUUpLeft', 16);
export const ArrowUp = /* @__PURE__ */ outlineIcon(LucideArrowUp, 'ArrowUp', 16);
export const ArrowUpFromDot = /* @__PURE__ */ outlineIcon(LucideArrowUpFromDot, 'ArrowUpFromDot', 16);
export const ArrowUpRight = /* @__PURE__ */ outlineIcon(LucideArrowUpRight, 'ArrowUpRight', 14);
export const ArrowsClockwise = /* @__PURE__ */ outlineIcon(LucideRefreshCw, 'ArrowsClockwise', 16);
export const ArrowsDownUp = /* @__PURE__ */ outlineIcon(LucideArrowDownUp, 'ArrowsDownUp', 16);
export const ArrowsHorizontal = /* @__PURE__ */ outlineIcon(LucideMoveHorizontal, 'ArrowsHorizontal', 16);
export const ArrowsInLineVertical = /* @__PURE__ */ outlineIcon(LucideFoldVertical, 'ArrowsInLineVertical', 16);
export const ArrowsInSimple = /* @__PURE__ */ outlineIcon(LucideMinimize, 'ArrowsInSimple', 16);
export const ArrowsLeftRight = /* @__PURE__ */ outlineIcon(LucideArrowLeftRight, 'ArrowsLeftRight', 16);
export const ArrowsOut = /* @__PURE__ */ outlineIcon(LucideMaximize, 'ArrowsOut', 16);
export const ArrowsOutLineHorizontal = /* @__PURE__ */ outlineIcon(LucideUnfoldHorizontal, 'ArrowsOutLineHorizontal', 16);
export const ArrowsOutLineVertical = /* @__PURE__ */ outlineIcon(LucideUnfoldVertical, 'ArrowsOutLineVertical', 16);
export const ArrowsOutSimple = /* @__PURE__ */ outlineIcon(LucideMaximize, 'ArrowsOutSimple', 16);
export const At = /* @__PURE__ */ solidIcon(faAt, 'At');
export const Atom = /* @__PURE__ */ solidIcon(faAtom, 'Atom');
export const Bell = /* @__PURE__ */ solidIcon(faBell, 'Bell');
export const BellSimpleSlash = /* @__PURE__ */ solidIcon(faBellSlash, 'BellSimpleSlash');
export const Binoculars = /* @__PURE__ */ solidIcon(faBinoculars, 'Binoculars');
export const BookOpen = /* @__PURE__ */ solidIcon(faBookOpen, 'BookOpen');
export const BookOpenText = /* @__PURE__ */ solidIcon(faBookOpen, 'BookOpenText');
export const BookmarkSimple = /* @__PURE__ */ solidIcon(faBookmark, 'BookmarkSimple');
export const BracketsCurly = /* @__PURE__ */ solidIcon(faCode, 'BracketsCurly');
export const Brain = /* @__PURE__ */ solidIcon(faBrain, 'Brain');
export const Briefcase = /* @__PURE__ */ solidIcon(faBriefcase, 'Briefcase');
export const Broadcast = /* @__PURE__ */ solidIcon(faTowerBroadcast, 'Broadcast');
export const Browser = /* @__PURE__ */ solidIcon(faWindowMaximize, 'Browser');
export const Buildings = /* @__PURE__ */ solidIcon(faBuilding, 'Buildings');
export const CalendarBlank = /* @__PURE__ */ solidIcon(faCalendar, 'CalendarBlank');
export const CalendarDots = /* @__PURE__ */ solidIcon(faCalendarDays, 'CalendarDots');
export const CalendarPlus = /* @__PURE__ */ solidIcon(faCalendarPlus, 'CalendarPlus');
export const CalendarX = /* @__PURE__ */ solidIcon(faCalendarXmark, 'CalendarX');
export const Camera = /* @__PURE__ */ solidIcon(faCamera, 'Camera');
export const CaretDoubleLeft = /* @__PURE__ */ outlineIcon(LucideChevronsLeft, 'CaretDoubleLeft', 16);
export const CaretDoubleRight = /* @__PURE__ */ outlineIcon(LucideChevronsRight, 'CaretDoubleRight', 16);
export const CaretDown = /* @__PURE__ */ outlineIcon(LucideChevronDown, 'CaretDown', 12);
export const CaretDownSolid = /* @__PURE__ */ solidIcon(faCaretDown, 'CaretDownSolid');
export const CaretLeft = /* @__PURE__ */ outlineIcon(LucideChevronLeft, 'CaretLeft', 12);
export const CaretLeftSolid = /* @__PURE__ */ solidIcon(faCaretLeft, 'CaretLeftSolid');
export const CaretRight = /* @__PURE__ */ outlineIcon(LucideChevronRight, 'CaretRight', 12);
export const CaretRightSolid = /* @__PURE__ */ solidIcon(faCaretRight, 'CaretRightSolid');
export const CaretUp = /* @__PURE__ */ outlineIcon(LucideChevronUp, 'CaretUp', 12);
export const CaretUpDown = /* @__PURE__ */ outlineIcon(LucideChevronsUpDown, 'CaretUpDown', 12);
export const CaretUpSolid = /* @__PURE__ */ solidIcon(faCaretUp, 'CaretUpSolid');
export const ChartBar = /* @__PURE__ */ solidIcon(faChartColumn, 'ChartBar');
export const ChartLine = /* @__PURE__ */ solidIcon(faChartLine, 'ChartLine');
export const ChartLineUp = /* @__PURE__ */ solidIcon(faChartLine, 'ChartLineUp');
export const ChartPieSlice = /* @__PURE__ */ solidIcon(faChartPie, 'ChartPieSlice');
export const ChatCenteredDots = /* @__PURE__ */ solidIcon(faCommentDots, 'ChatCenteredDots');
export const ChatCenteredText = /* @__PURE__ */ solidIcon(faCommentDots, 'ChatCenteredText');
export const ChatCircle = /* @__PURE__ */ solidIcon(faComment, 'ChatCircle');
export const ChatCircleDots = /* @__PURE__ */ solidIcon(faCommentDots, 'ChatCircleDots');
export const ChatCircleText = /* @__PURE__ */ solidIcon(faCommentDots, 'ChatCircleText');
export const ChatText = /* @__PURE__ */ solidIcon(faComment, 'ChatText');
export const Chats = /* @__PURE__ */ solidIcon(faComments, 'Chats');
export const ChatsCircle = /* @__PURE__ */ solidIcon(faComments, 'ChatsCircle');
export const Check = /* @__PURE__ */ outlineIcon(LucideCheck, 'Check', 12);
export const CheckCircle = /* @__PURE__ */ solidIcon(faCircleCheck, 'CheckCircle');
export const CheckSquare = /* @__PURE__ */ solidIcon(faSquareCheck, 'CheckSquare');
export const Checks = /* @__PURE__ */ outlineIcon(LucideCheckCheck, 'Checks', 12);
export const ChevronDown = /* @__PURE__ */ outlineIcon(LucideChevronDown, 'ChevronDown', 16);
export const ChevronRight = /* @__PURE__ */ outlineIcon(LucideChevronRight, 'ChevronRight', 16);
export const ChevronsUp = /* @__PURE__ */ outlineIcon(LucideChevronsUp, 'ChevronsUp', 16);
export const Circle = /* @__PURE__ */ solidIcon(faCircle, 'Circle');
export const CircleDashed = /* @__PURE__ */ outlineIcon(LucideCircleDashed, 'CircleDashed', 16);
export const CircleFadingArrowUp = /* @__PURE__ */ solidIcon(faCircleArrowUp, 'CircleFadingArrowUp');
export const CircleHelp = /* @__PURE__ */ solidIcon(faCircleQuestion, 'CircleHelp');
export const CircleNotch = /* @__PURE__ */ outlineIcon(LucideLoaderCircle, 'CircleNotch', 14);
export const CirclesFour = /* @__PURE__ */ solidIcon(faTableCellsLarge, 'CirclesFour');
export const Clipboard = /* @__PURE__ */ solidIcon(faClipboard, 'Clipboard');
export const ClipboardText = /* @__PURE__ */ solidIcon(faClipboardList, 'ClipboardText');
export const Clock = /* @__PURE__ */ solidIcon(faClock, 'Clock');
export const ClockCounterClockwise = /* @__PURE__ */ solidIcon(faClockRotateLeft, 'ClockCounterClockwise');
export const Code = /* @__PURE__ */ solidIcon(faCode, 'Code');
export const CodeBlock = /* @__PURE__ */ solidIcon(faFileCode, 'CodeBlock');
export const Coffee = /* @__PURE__ */ solidIcon(faMugSaucer, 'Coffee');
export const Columns = /* @__PURE__ */ solidIcon(faTableColumns, 'Columns');
export const Columns3 = /* @__PURE__ */ solidIcon(faTableColumns, 'Columns3');
export const Copy = /* @__PURE__ */ solidIcon(faCopy, 'Copy');
export const CopySimple = /* @__PURE__ */ solidIcon(faCopy, 'CopySimple');
export const CornersOut = /* @__PURE__ */ outlineIcon(LucideMaximize, 'CornersOut', 16);
export const Crosshair = /* @__PURE__ */ solidIcon(faCrosshairs, 'Crosshair');
export const Database = /* @__PURE__ */ solidIcon(faDatabase, 'Database');
export const DiceFive = /* @__PURE__ */ solidIcon(faDiceFive, 'DiceFive');
export const DoorOpen = /* @__PURE__ */ solidIcon(faDoorOpen, 'DoorOpen');
export const DotsSix = /* @__PURE__ */ solidIcon(faGrip, 'DotsSix');
export const DotsSixVertical = /* @__PURE__ */ solidIcon(faGripVertical, 'DotsSixVertical');
export const DotsThree = /* @__PURE__ */ outlineIcon(LucideEllipsis, 'DotsThree', 14);
export const DownloadSimple = /* @__PURE__ */ solidIcon(faDownload, 'DownloadSimple');
export const EnvelopeSimple = /* @__PURE__ */ solidIcon(faEnvelope, 'EnvelopeSimple');
export const Eraser = /* @__PURE__ */ solidIcon(faEraser, 'Eraser');
export const Export = /* @__PURE__ */ solidIcon(faArrowUpFromBracket, 'Export');
export const Eye = /* @__PURE__ */ solidIcon(faEye, 'Eye');
export const EyeClosed = /* @__PURE__ */ solidIcon(faEyeSlash, 'EyeClosed');
export const EyeSlash = /* @__PURE__ */ solidIcon(faEyeSlash, 'EyeSlash');
export const FigmaLogo = /* @__PURE__ */ solidIcon(faPenRuler, 'FigmaLogo');
export const File = /* @__PURE__ */ solidIcon(faFile, 'File');
export const FileArrowUp = /* @__PURE__ */ solidIcon(faFileArrowUp, 'FileArrowUp');
export const FileCode = /* @__PURE__ */ solidIcon(faFileCode, 'FileCode');
export const FilePdf = /* @__PURE__ */ solidIcon(faFilePdf, 'FilePdf');
export const FileSql = /* @__PURE__ */ solidIcon(faFileCode, 'FileSql');
export const FileText = /* @__PURE__ */ solidIcon(faFileLines, 'FileText');
export const Files = /* @__PURE__ */ solidIcon(faCopy, 'Files');
export const Fingerprint = /* @__PURE__ */ solidIcon(faFingerprint, 'Fingerprint');
export const Flag = /* @__PURE__ */ solidIcon(faFlag, 'Flag');
export const FlagOutline = /* @__PURE__ */ outlineIcon(LucideFlag, 'FlagOutline', 16);
export const Flame = /* @__PURE__ */ solidIcon(faFire, 'Flame');
export const FloppyDisk = /* @__PURE__ */ solidIcon(faFloppyDisk, 'FloppyDisk');
export const FlowArrow = /* @__PURE__ */ solidIcon(faDiagramProject, 'FlowArrow');
export const Folder = /* @__PURE__ */ solidIcon(faFolder, 'Folder');
export const FolderCode = /* @__PURE__ */ solidIcon(faFolderOpen, 'FolderCode');
export const FolderOpen = /* @__PURE__ */ solidIcon(faFolderOpen, 'FolderOpen');
export const FolderPlus = /* @__PURE__ */ solidIcon(faFolderPlus, 'FolderPlus');
export const FolderSimple = /* @__PURE__ */ solidIcon(faFolder, 'FolderSimple');
export const Function = /* @__PURE__ */ solidIcon(faSquareRootVariable, 'Function');
export const Funnel = /* @__PURE__ */ solidIcon(faFilter, 'Funnel');
export const GearSix = /* @__PURE__ */ solidIcon(faGear, 'GearSix');
export const GitBranch = /* @__PURE__ */ solidIcon(faCodeBranch, 'GitBranch');
export const GitDiff = /* @__PURE__ */ solidIcon(faCodeCompare, 'GitDiff');
export const GitFork = /* @__PURE__ */ solidIcon(faCodeFork, 'GitFork');
export const GithubLogo = /* @__PURE__ */ solidIcon(faCodeBranch, 'GithubLogo');
export const Globe = /* @__PURE__ */ solidIcon(faGlobe, 'Globe');
export const GoogleLogo = /* @__PURE__ */ solidIcon(faG, 'GoogleLogo');
export const Graph = /* @__PURE__ */ solidIcon(faDiagramProject, 'Graph');
export const Grid2X2 = /* @__PURE__ */ solidIcon(faTableCellsLarge, 'Grid2X2');
export const GridFour = /* @__PURE__ */ solidIcon(faTableCellsLarge, 'GridFour');
export const Hand = /* @__PURE__ */ solidIcon(faHand, 'Hand');
export const Hash = /* @__PURE__ */ solidIcon(faHashtag, 'Hash');
export const Heart = /* @__PURE__ */ solidIcon(faHeart, 'Heart');
export const Highlighter = /* @__PURE__ */ solidIcon(faHighlighter, 'Highlighter');
export const Image = /* @__PURE__ */ solidIcon(faImage, 'Image');
export const ImageSquare = /* @__PURE__ */ solidIcon(faImage, 'ImageSquare');
export const Info = /* @__PURE__ */ solidIcon(faCircleInfo, 'Info');
export const Intersect = /* @__PURE__ */ solidIcon(faObjectGroup, 'Intersect');
export const Kanban = /* @__PURE__ */ solidIcon(faTableColumns, 'Kanban');
export const Key = /* @__PURE__ */ solidIcon(faKey, 'Key');
export const KeyRound = /* @__PURE__ */ solidIcon(faKey, 'KeyRound');
export const Layers3 = /* @__PURE__ */ solidIcon(faLayerGroup, 'Layers3');
export const Leaf = /* @__PURE__ */ solidIcon(faLeaf, 'Leaf');
export const Lightbulb = /* @__PURE__ */ solidIcon(faLightbulb, 'Lightbulb');
export const Lightning = /* @__PURE__ */ solidIcon(faBolt, 'Lightning');
export const Link = /* @__PURE__ */ solidIcon(faLink, 'Link');
export const LinkSimple = /* @__PURE__ */ solidIcon(faLink, 'LinkSimple');
export const List = /* @__PURE__ */ solidIcon(faListUl, 'List');
export const ListBullets = /* @__PURE__ */ solidIcon(faListUl, 'ListBullets');
export const ListChecks = /* @__PURE__ */ solidIcon(faListCheck, 'ListChecks');
export const Lock = /* @__PURE__ */ solidIcon(faLock, 'Lock');
export const LockKey = /* @__PURE__ */ solidIcon(faLock, 'LockKey');
export const LockOpen = /* @__PURE__ */ solidIcon(faLockOpen, 'LockOpen');
export const LockSimple = /* @__PURE__ */ solidIcon(faLock, 'LockSimple');
export const MagicWand = /* @__PURE__ */ solidIcon(faWandMagicSparkles, 'MagicWand');
export const MagnifyingGlass = /* @__PURE__ */ solidIcon(faMagnifyingGlass, 'MagnifyingGlass', { stroke: 'currentColor', strokeWidth: 16, strokeLinejoin: 'round' });
export const MagnifyingGlassMinus = /* @__PURE__ */ outlineIcon(LucideZoomOut, 'MagnifyingGlassMinus', 16);
export const MagnifyingGlassPlus = /* @__PURE__ */ outlineIcon(LucideZoomIn, 'MagnifyingGlassPlus', 16);
export const Megaphone = /* @__PURE__ */ solidIcon(faBullhorn, 'Megaphone');
export const Microphone = /* @__PURE__ */ solidIcon(faMicrophone, 'Microphone');
export const Minus = /* @__PURE__ */ outlineIcon(LucideMinus, 'Minus', 12);
export const Monitor = /* @__PURE__ */ solidIcon(faDesktop, 'Monitor');
export const Moon = /* @__PURE__ */ solidIcon(faMoon, 'Moon');
export const Network = /* @__PURE__ */ solidIcon(faDiagramProject, 'Network');
export const NotePencil = /* @__PURE__ */ solidIcon(faFilePen, 'NotePencil');
export const Orbit = /* @__PURE__ */ solidIcon(faAtom, 'Orbit');
export const PaintBrush = /* @__PURE__ */ solidIcon(faPaintbrush, 'PaintBrush');
export const Palette = /* @__PURE__ */ solidIcon(faPalette, 'Palette');
export const PanelLeftClose = /* @__PURE__ */ outlineIcon(LucidePanelLeftClose, 'PanelLeftClose', 16);
export const PanelsTopLeft = /* @__PURE__ */ solidIcon(faWindowRestore, 'PanelsTopLeft');
export const PaperPlaneTilt = /* @__PURE__ */ solidIcon(faPaperPlane, 'PaperPlaneTilt');
export const Paperclip = /* @__PURE__ */ solidIcon(faPaperclip, 'Paperclip');
export const Path = /* @__PURE__ */ solidIcon(faRoute, 'Path');
export const Pause = /* @__PURE__ */ solidIcon(faPause, 'Pause');
export const PenNib = /* @__PURE__ */ solidIcon(faPenNib, 'PenNib');
export const PencilSimple = /* @__PURE__ */ solidIcon(faPen, 'PencilSimple');
export const Planet = /* @__PURE__ */ solidIcon(faGlobe, 'Planet');
export const Play = /* @__PURE__ */ solidIcon(faPlay, 'Play');
export const PlayCircle = /* @__PURE__ */ solidIcon(faCirclePlay, 'PlayCircle');
export const PlaySquare = /* @__PURE__ */ solidIcon(faSquareCaretRight, 'PlaySquare');
export const Plug = /* @__PURE__ */ solidIcon(faPlug, 'Plug');
export const Plugs = /* @__PURE__ */ solidIcon(faPlug, 'Plugs');
export const PlugsConnected = /* @__PURE__ */ solidIcon(faPlugCircleCheck, 'PlugsConnected');
export const Plus = /* @__PURE__ */ outlineIcon(LucidePlus, 'Plus', 14);
export const PlusCircle = /* @__PURE__ */ solidIcon(faCirclePlus, 'PlusCircle');
export const PresentationChart = /* @__PURE__ */ solidIcon(faChalkboard, 'PresentationChart');
export const PushPin = /* @__PURE__ */ solidIcon(faThumbtack, 'PushPin');
export const PushPinSlash = /* @__PURE__ */ solidIcon(faThumbtackSlash, 'PushPinSlash');
export const PuzzlePiece = /* @__PURE__ */ solidIcon(faPuzzlePiece, 'PuzzlePiece');
export const Question = /* @__PURE__ */ solidIcon(faCircleQuestion, 'Question');
export const Receipt = /* @__PURE__ */ solidIcon(faReceipt, 'Receipt');
export const RefreshCw = /* @__PURE__ */ outlineIcon(LucideRefreshCw, 'RefreshCw', 16);
export const Robot = /* @__PURE__ */ solidIcon(faRobot, 'Robot');
export const RocketLaunch = /* @__PURE__ */ solidIcon(faRocket, 'RocketLaunch');
export const Rows = /* @__PURE__ */ solidIcon(faTableList, 'Rows');
export const Scan = /* @__PURE__ */ solidIcon(faExpand, 'Scan');
export const Scroll = /* @__PURE__ */ solidIcon(faScroll, 'Scroll');
export const SealCheck = /* @__PURE__ */ solidIcon(faCertificate, 'SealCheck');
export const Search = /* @__PURE__ */ solidIcon(faMagnifyingGlass, 'Search');
export const SelectionCheck = /* @__PURE__ */ outlineIcon(LucideCheck, 'SelectionCheck', ICON_SIZES.selection, 2);
export const ShareFat = /* @__PURE__ */ solidIcon(faShareNodes, 'ShareFat');
export const ShareNetwork = /* @__PURE__ */ solidIcon(faShareNodes, 'ShareNetwork');
export const ShieldCheck = /* @__PURE__ */ solidIcon(faShieldHalved, 'ShieldCheck');
export const ShieldWarning = /* @__PURE__ */ solidIcon(faShieldHalved, 'ShieldWarning');
export const SidebarSimple = /* @__PURE__ */ outlineIcon(LucidePanelLeft, 'SidebarSimple', 16);
export const SignIn = /* @__PURE__ */ solidIcon(faRightToBracket, 'SignIn');
export const SignOut = /* @__PURE__ */ solidIcon(faRightFromBracket, 'SignOut');
export const SkipForward = /* @__PURE__ */ solidIcon(faForwardStep, 'SkipForward');
export const SlidersHorizontal = /* @__PURE__ */ solidIcon(faSliders, 'SlidersHorizontal');
export const Smile = /* @__PURE__ */ solidIcon(faFaceSmile, 'Smile');
export const SmilePlus = /* @__PURE__ */ solidIcon(faFaceSmileBeam, 'SmilePlus');
export const Smiley = /* @__PURE__ */ solidIcon(faFaceSmile, 'Smiley');
export const SortAscending = /* @__PURE__ */ solidIcon(faArrowDownAZ, 'SortAscending');
export const Sparkle = /* @__PURE__ */ solidIcon(faWandMagicSparkles, 'Sparkle');
export const Sparkles = /* @__PURE__ */ solidIcon(faWandMagicSparkles, 'Sparkles');
export const Spinner = /* @__PURE__ */ outlineIcon(LucideLoaderCircle, 'Spinner', 14);
export const SpinnerGap = /* @__PURE__ */ outlineIcon(LucideLoaderCircle, 'SpinnerGap', 14);
export const Square = /* @__PURE__ */ outlineIcon(LucideSquare, 'Square', 16);
export const SquareSplitHorizontal = /* @__PURE__ */ solidIcon(faTableColumns, 'SquareSplitHorizontal');
export const SquaresFour = /* @__PURE__ */ solidIcon(faTableCellsLarge, 'SquaresFour');
export const Stack = /* @__PURE__ */ solidIcon(faLayerGroup, 'Stack');
export const StackSimple = /* @__PURE__ */ solidIcon(faLayerGroup, 'StackSimple');
export const Star = /* @__PURE__ */ solidIcon(faStar, 'Star');
export const StarHalf = /* @__PURE__ */ solidIcon(faStarHalfStroke, 'StarHalf');
export const StarOutline = /* @__PURE__ */ outlineIcon(LucideStar, 'StarOutline', 16);
export const Stop = /* @__PURE__ */ solidIcon(faStop, 'Stop');
export const StopCircle = /* @__PURE__ */ solidIcon(faCircleStop, 'StopCircle');
export const Sun = /* @__PURE__ */ solidIcon(faSun, 'Sun');
export const Table = /* @__PURE__ */ solidIcon(faTable, 'Table');
export const Tabs = /* @__PURE__ */ solidIcon(faClone, 'Tabs');
export const Tag = /* @__PURE__ */ solidIcon(faTag, 'Tag');
export const Target = /* @__PURE__ */ solidIcon(faBullseye, 'Target');
export const TerminalWindow = /* @__PURE__ */ solidIcon(faTerminal, 'TerminalWindow');
export const TextAa = /* @__PURE__ */ solidIcon(faFont, 'TextAa');
export const TextAlignJustify = /* @__PURE__ */ solidIcon(faAlignJustify, 'TextAlignJustify');
export const TextAlignLeft = /* @__PURE__ */ solidIcon(faAlignLeft, 'TextAlignLeft');
export const TextAlignRight = /* @__PURE__ */ solidIcon(faAlignRight, 'TextAlignRight');
export const TextB = /* @__PURE__ */ solidIcon(faBold, 'TextB');
export const TextItalic = /* @__PURE__ */ solidIcon(faItalic, 'TextItalic');
export const TextT = /* @__PURE__ */ solidIcon(faT, 'TextT');
export const Timer = /* @__PURE__ */ solidIcon(faStopwatch, 'Timer');
export const Toolbox = /* @__PURE__ */ solidIcon(faToolbox, 'Toolbox');
export const Translate = /* @__PURE__ */ solidIcon(faLanguage, 'Translate');
export const Trash = /* @__PURE__ */ solidIcon(faTrashCan, 'Trash');
export const TrashSimple = /* @__PURE__ */ solidIcon(faTrashCan, 'TrashSimple');
export const Tray = /* @__PURE__ */ solidIcon(faInbox, 'Tray');
export const TreeStructure = /* @__PURE__ */ solidIcon(faSitemap, 'TreeStructure');
export const UploadSimple = /* @__PURE__ */ solidIcon(faUpload, 'UploadSimple');
export const User = /* @__PURE__ */ solidIcon(faUser, 'User');
export const UserCircle = /* @__PURE__ */ solidIcon(faCircleUser, 'UserCircle');
export const UserMinus = /* @__PURE__ */ solidIcon(faUserMinus, 'UserMinus');
export const UserPlus = /* @__PURE__ */ solidIcon(faUserPlus, 'UserPlus');
export const Users = /* @__PURE__ */ solidIcon(faUserGroup, 'Users');
export const UsersThree = /* @__PURE__ */ solidIcon(faUserGroup, 'UsersThree');
export const Video = /* @__PURE__ */ solidIcon(faVideo, 'Video');
export const VideoCamera = /* @__PURE__ */ solidIcon(faVideo, 'VideoCamera');
export const WandSparkles = /* @__PURE__ */ solidIcon(faWandMagicSparkles, 'WandSparkles');
export const Warning = /* @__PURE__ */ solidIcon(faTriangleExclamation, 'Warning');
export const WarningCircle = /* @__PURE__ */ solidIcon(faCircleExclamation, 'WarningCircle');
export const Waveform = /* @__PURE__ */ solidIcon(faWaveSquare, 'Waveform');
export const WifiSlash = /* @__PURE__ */ outlineIcon(LucideWifiOff, 'WifiSlash', 16);
export const Wrench = /* @__PURE__ */ solidIcon(faWrench, 'Wrench');
export const X = /* @__PURE__ */ outlineIcon(LucideX, 'X', 14);
export const XCircle = /* @__PURE__ */ solidIcon(faCircleXmark, 'XCircle');
export const XSquare = /* @__PURE__ */ outlineIcon(LucideSquareX, 'XSquare', 16);
export const Zap = /* @__PURE__ */ solidIcon(faBolt, 'Zap');

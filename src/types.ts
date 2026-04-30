export type ContentType =
  | "setup_del_dia"
  | "reel_setup"
  | "carrusel_top3"
  | "reel_preview"
  | "analisis"
  | "chart_analysis"
  | "educacion"
  | "carrusel_educativo"
  | "recap_semanal"
  | "setup_mra"
  | "reel_viral";

export type PostTipo = "post" | "reel" | "carrusel" | "story";
export type PostStatus = "pending" | "published" | "failed";

export interface ContentItem {
  id: string;
  date: string;
  hora: string;
  contentType: ContentType;
  tipo: PostTipo;
  caption: string;
  hashtags: string[];
  imagePrompts: string[];
  mediaUrls: string[];
  scheduledFor: string;
  status: PostStatus;
  instagramPostId?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface GeneratedContent {
  caption: string;
  hashtags: string[];
  imagePrompts: string[];
}

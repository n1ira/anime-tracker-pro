import os
import json
import webbrowser
import requests
import threading
import tkinter as tk
from tkinter import ttk, messagebox, StringVar, IntVar
from typing import List, Dict, Set, Tuple
import re
from datetime import datetime
from openai import OpenAI
from bs4 import BeautifulSoup

# --- Helper Functions ---
def debug_log(message: str):
    """Print detailed debug messages to the console."""
    print(message)

def normalize_show_name(name: str) -> str:
    """
    Normalize a show name by lowercasing and removing punctuation and extra whitespace.
    """
    name = name.lower().strip()
    name = re.sub(r"[’'\",:;\-]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name

def current_timestamp() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# --- Dialog Classes ---
class AddShowDialog(tk.Toplevel):
    def __init__(self, parent):
        super().__init__(parent)
        self.title("Add New Show")
        self.result = None
        self.names = []
        
        # Form variables
        self.new_name = StringVar()
        self.start_season = IntVar(value=1)
        self.start_episode = IntVar(value=1)
        self.end_season = IntVar(value=1)
        self.end_episode = IntVar(value=1)
        self.quality = StringVar(value="1080p")

        main_frame = ttk.Frame(self, padding=15)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Show names
        ttk.Label(main_frame, text="Show Names:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.names_listbox = tk.Listbox(main_frame, width=30, height=3)
        self.names_listbox.grid(row=0, column=1, columnspan=2, sticky=tk.W+tk.E, pady=5)
        
        name_entry_frame = ttk.Frame(main_frame)
        name_entry_frame.grid(row=1, column=1, columnspan=2, sticky=tk.W+tk.E)
        ttk.Entry(name_entry_frame, textvariable=self.new_name, width=25).pack(side=tk.LEFT, padx=2)
        ttk.Button(name_entry_frame, text="Add", command=self.add_name).pack(side=tk.LEFT, padx=2)
        ttk.Button(name_entry_frame, text="Remove", command=self.remove_name).pack(side=tk.LEFT, padx=2)

        # Tracking range
        ttk.Label(main_frame, text="Tracking Range:").grid(row=2, column=0, sticky=tk.W, pady=5)
        range_frame = ttk.Frame(main_frame)
        range_frame.grid(row=2, column=1, columnspan=3, sticky=tk.W)

        ttk.Spinbox(range_frame, from_=1, to=100, textvariable=self.start_season, width=3).pack(side=tk.LEFT)
        ttk.Label(range_frame, text="S").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(range_frame, from_=1, to=100, textvariable=self.start_episode, width=3).pack(side=tk.LEFT)
        ttk.Label(range_frame, text="E").pack(side=tk.LEFT, padx=5)

        ttk.Label(range_frame, text="➔").pack(side=tk.LEFT, padx=5)

        ttk.Spinbox(range_frame, from_=1, to=100, textvariable=self.end_season, width=3).pack(side=tk.LEFT)
        ttk.Label(range_frame, text="S").pack(side=tk.LEFT, padx=2)
        ttk.Spinbox(range_frame, from_=1, to=100, textvariable=self.end_episode, width=3).pack(side=tk.LEFT)
        ttk.Label(range_frame, text="E").pack(side=tk.LEFT, padx=5)

        # Quality
        ttk.Label(main_frame, text="Quality:").grid(row=3, column=0, sticky=tk.W, pady=5)
        ttk.Combobox(main_frame, textvariable=self.quality, values=["1080p", "720p", "480p"], width=8).grid(row=3, column=1, sticky=tk.W, pady=5)

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=4, column=0, columnspan=4, pady=15)
        ttk.Button(button_frame, text="Add", command=self.validate).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side=tk.LEFT, padx=5)

    def add_name(self):
        name = self.new_name.get().strip()
        if name and name not in self.names:
            self.names.append(name)
            self.names_listbox.insert(tk.END, name)
            self.new_name.set("")

    def remove_name(self):
        selected = self.names_listbox.curselection()
        if selected:
            index = selected[0]
            self.names_listbox.delete(index)
            del self.names[index]

    def validate(self):
        if not self.names:
            messagebox.showerror("Error", "Please add at least one show name")
            return

        self.result = {
            'names': self.names,
            'start_season': self.start_season.get(),
            'start_episode': self.start_episode.get(),
            'end_season': self.end_season.get(),
            'end_episode': self.end_episode.get(),
            'quality': self.quality.get()
        }
        self.destroy()

class EditShowDialog(AddShowDialog):
    def __init__(self, parent, show_data):
        super().__init__(parent)
        self.title("Edit Show")
        self.names = show_data['names']
        self.names_listbox.delete(0, tk.END)
        for name in self.names:
            self.names_listbox.insert(tk.END, name)
        self.start_season.set(show_data['start_season'])
        self.start_episode.set(show_data['start_episode'])
        self.end_season.set(show_data['end_season'])
        self.end_episode.set(show_data['end_episode'])
        self.quality.set(show_data['quality'])

class EditKnownShowsDialog(tk.Toplevel):
    def __init__(self, parent, known_shows, save_callback):
        super().__init__(parent)
        self.title("Edit Known Shows")
        self.known_shows = known_shows
        self.save_callback = save_callback
        self.current_edit_index = None

        self.show_name_var = StringVar()
        self.episodes_per_season_var = StringVar()

        main_frame = ttk.Frame(self, padding=15)
        main_frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(main_frame, text="Known Shows:").grid(row=0, column=0, sticky=tk.W, pady=5)
        self.shows_listbox = tk.Listbox(main_frame, width=50, height=15)
        self.shows_listbox.grid(row=1, column=0, sticky=tk.NSEW, pady=5, padx=5)
        self.shows_listbox.bind("<Double-Button-1>", self.load_show_for_edit)

        details_frame = ttk.Frame(main_frame)
        details_frame.grid(row=1, column=1, sticky=tk.NSEW, padx=5, pady=5)

        ttk.Label(details_frame, text="Show Name:").grid(row=0, column=0, sticky=tk.W, pady=5)
        ttk.Entry(details_frame, textvariable=self.show_name_var, width=30).grid(row=0, column=1, sticky=tk.W, pady=5)

        ttk.Label(details_frame, text="Episodes/Season (comma-separated):").grid(row=1, column=0, sticky=tk.W, pady=5)
        ttk.Entry(details_frame, textvariable=self.episodes_per_season_var, width=20).grid(row=1, column=1, sticky=tk.W, pady=5)

        buttons_frame = ttk.Frame(main_frame)
        buttons_frame.grid(row=2, column=0, columnspan=2, pady=10)

        ttk.Button(buttons_frame, text="Add New Show", command=self.add_show).pack(side=tk.LEFT, padx=5)
        ttk.Button(buttons_frame, text="Delete Show", command=self.delete_show).pack(side=tk.LEFT, padx=5)
        ttk.Button(buttons_frame, text="Save & Close", command=self.save_and_close).pack(side=tk.LEFT, padx=5)
        ttk.Button(buttons_frame, text="Cancel", command=self.destroy).pack(side=tk.LEFT, padx=5)

        self.populate_show_list()
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        main_frame.grid_columnconfigure(0, weight=1)
        main_frame.grid_rowconfigure(1, weight=1)

    def populate_show_list(self):
        self.shows_listbox.delete(0, tk.END)
        for show_name in sorted(self.known_shows.keys()):
            self.shows_listbox.insert(tk.END, show_name)

    def load_show_for_edit(self, event=None):
        selected_show_index = self.shows_listbox.curselection()
        if selected_show_index:
            self.current_edit_index = selected_show_index[0]
            selected_show_name = self.shows_listbox.get(self.current_edit_index)
            show_data = self.known_shows[selected_show_name]
            self.show_name_var.set(selected_show_name)
            
            eps_data = show_data.get('episodes_per_season', 12)
            if isinstance(eps_data, list):
                eps_str = ','.join(map(str, eps_data))
            else:
                eps_str = str(eps_data)
            self.episodes_per_season_var.set(eps_str)
            
            self.shows_listbox.selection_clear(0, tk.END)
            self.shows_listbox.selection_set(self.current_edit_index)
            self.shows_listbox.activate(self.current_edit_index)

    def add_show(self):
        show_name = self.show_name_var.get().strip()
        eps_input = self.episodes_per_season_var.get().strip()
        
        if not show_name:
            messagebox.showerror("Error", "Show name cannot be empty.")
            return
            
        try:
            if ',' in eps_input:
                episodes_per_season = list(map(int, eps_input.split(',')))
            else:
                episodes_per_season = int(eps_input)
        except ValueError:
            messagebox.showerror("Error", "Invalid episodes format. Use integers separated by commas.")
            return

        if show_name in self.known_shows:
            messagebox.showerror("Error", "Show already exists. Use 'Delete Show' to remove it first.")
            return

        self.known_shows[show_name] = {'episodes_per_season': episodes_per_season}
        self.populate_show_list()
        self.clear_entry_fields()

    def delete_show(self):
        selected_show_index = self.shows_listbox.curselection()
        if not selected_show_index:
            messagebox.showerror("Error", "Select a show to delete.")
            return

        selected_show_name = self.shows_listbox.get(selected_show_index[0])
        if messagebox.askyesno("Confirm Delete", f"Are you sure you want to delete '{selected_show_name}' from known shows?"):
            del self.known_shows[selected_show_name]
            self.populate_show_list()
            self.clear_entry_fields()

    def clear_entry_fields(self):
        self.show_name_var.set("")
        self.episodes_per_season_var.set("")
        self.current_edit_index = None

    def save_and_close(self):
        if self.current_edit_index is None:
            self.save_callback(self.known_shows)
            self.destroy()
            return

        original_show_name = self.shows_listbox.get(self.current_edit_index)
        new_show_name = self.show_name_var.get().strip()
        eps_input = self.episodes_per_season_var.get().strip()

        try:
            if ',' in eps_input:
                episodes_per_season = list(map(int, eps_input.split(',')))
            else:
                episodes_per_season = int(eps_input)
        except ValueError:
            messagebox.showerror("Error", "Invalid episodes format. Use integers separated by commas.")
            return

        if not new_show_name:
            messagebox.showerror("Error", "Show name cannot be empty.")
            return

        if new_show_name != original_show_name and new_show_name in self.known_shows:
            messagebox.showerror("Error", "Show name already exists.")
            return

        if new_show_name != original_show_name:
            self.known_shows[new_show_name] = self.known_shows.pop(original_show_name)
            self.shows_listbox.delete(self.current_edit_index)
            self.shows_listbox.insert(self.current_edit_index, new_show_name)
            self.shows_listbox.selection_set(self.current_edit_index)
            show_to_update = new_show_name
        else:
            show_to_update = original_show_name

        self.known_shows[show_to_update]['episodes_per_season'] = episodes_per_season
        self.save_callback(self.known_shows)
        self.destroy()

# --- Main Application Class ---
class AnimeTrackerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Anime Tracker Pro")
        self.root.geometry("1200x800")
        self.scanning = False

        # Configuration
        self.config = {
            'openai_model': 'gpt-4o-mini',
            'nyaa_url': 'https://nyaa.si/',
            'known_shows_file': 'known_shows.json'
        }
        self.known_shows = self.load_known_shows()

        # State
        self.tracked_shows = []

        # Stop event for scanning
        self.stop_scan_event = threading.Event()

        # GUI Setup
        self.create_widgets()
        self.setup_layout()

        self.load_state()
        self.update_show_list()

        self.root.after(100, self.recalculate_needed_for_all_shows)
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def create_widgets(self):
        self.main_frame = ttk.Frame(self.root, padding=10)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Control Buttons
        self.control_frame = ttk.Frame(self.main_frame)
        self.btn_add = ttk.Button(self.control_frame, text="Add Show", command=self.add_show)
        self.btn_remove = ttk.Button(self.control_frame, text="Remove Selected", command=self.remove_show)
        self.btn_scan = ttk.Button(self.control_frame, text="Scan Now", command=self.toggle_scan)
        self.btn_edit_known_shows = ttk.Button(self.control_frame, text="Edit Known Shows", command=self.edit_known_shows_gui)
        self.btn_reset_show = ttk.Button(self.control_frame, text="Reset Show", command=self.reset_show)

        # Tracked Shows List
        self.tracked_frame = ttk.LabelFrame(self.main_frame, text="Tracked Shows")
        self.listbox = tk.Listbox(self.tracked_frame, selectmode=tk.SINGLE, font=('TkDefaultFont', 10))
        self.scrollbar = ttk.Scrollbar(self.tracked_frame, orient=tk.VERTICAL)

        # Episode Status Treeview
        self.episodes_frame = ttk.LabelFrame(self.main_frame, text="Episodes")
        self.episodes_tree = ttk.Treeview(self.episodes_frame, columns=('Season', 'Episode', 'Status'),
                                          show='headings', style='Custom.Treeview')
        self.episodes_tree.heading('Season', text='Season', anchor=tk.W)
        self.episodes_tree.heading('Episode', text='Episode', anchor=tk.W)
        self.episodes_tree.heading('Status', text='Status', anchor=tk.W)
        self.episodes_tree.tag_configure('downloaded', foreground='green')
        self.episodes_tree.tag_configure('needed', foreground='red')
        self.episodes_scroll = ttk.Scrollbar(self.episodes_frame)

        # Log Panel
        self.log_frame = ttk.LabelFrame(self.main_frame, text="Activity Log")
        self.log_text = tk.Text(self.log_frame, wrap=tk.WORD, state=tk.DISABLED, font=('TkFixedFont', 9))
        self.log_scroll = ttk.Scrollbar(self.log_frame)

        # Status Bar
        self.status_var = tk.StringVar()
        self.status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN, font=('TkDefaultFont', 9))

        # Configure styles
        style = ttk.Style()
        style.configure('Custom.Treeview', rowheight=25, font=('TkDefaultFont', 10))
        style.configure('Custom.Treeview.Heading', font=('TkDefaultFont', 10, 'bold'))

    def setup_layout(self):
        self.control_frame.grid(row=0, column=0, columnspan=2, sticky=tk.EW, pady=5)
        self.btn_add.pack(side=tk.LEFT, padx=5)
        self.btn_remove.pack(side=tk.LEFT, padx=5)
        self.btn_scan.pack(side=tk.LEFT, padx=5)
        self.btn_edit_known_shows.pack(side=tk.LEFT, padx=5)
        self.btn_reset_show.pack(side=tk.LEFT, padx=5)

        self.tracked_frame.grid(row=1, column=0, sticky=tk.NSEW, padx=5, pady=5)
        self.listbox.grid(row=0, column=0, sticky=tk.NSEW, padx=5, pady=5)
        self.scrollbar.grid(row=0, column=1, sticky=tk.NS)
        self.listbox.config(yscrollcommand=self.scrollbar.set)
        self.scrollbar.config(command=self.listbox.yview)

        self.episodes_frame.grid(row=1, column=1, sticky=tk.NSEW, padx=5, pady=5)
        self.episodes_tree.grid(row=0, column=0, sticky=tk.NSEW, padx=5, pady=5)
        self.episodes_scroll.grid(row=0, column=1, sticky=tk.NS)
        self.episodes_tree.config(yscrollcommand=self.episodes_scroll.set)
        self.episodes_scroll.config(command=self.episodes_tree.yview)

        self.log_frame.grid(row=2, column=0, columnspan=2, sticky=tk.NSEW, pady=5)
        self.log_text.grid(row=0, column=0, sticky=tk.NSEW, padx=5, pady=5)
        self.log_scroll.grid(row=0, column=1, sticky=tk.NS)
        self.log_text.config(yscrollcommand=self.log_scroll.set)
        self.log_scroll.config(command=self.log_text.yview)

        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)

        self.main_frame.grid_columnconfigure(0, weight=1, uniform='column')
        self.main_frame.grid_columnconfigure(1, weight=1, uniform='column')
        self.main_frame.grid_rowconfigure(1, weight=3)
        self.main_frame.grid_rowconfigure(2, weight=1)

        for frame in [self.tracked_frame, self.episodes_frame, self.log_frame]:
            frame.grid_rowconfigure(0, weight=1)
            frame.grid_columnconfigure(0, weight=1)

        self.listbox.bind('<<ListboxSelect>>', self.on_show_selected)
        self.listbox.bind("<Double-Button-1>", self.edit_show)

    def on_show_selected(self, event):
        selection = self.listbox.curselection()
        if selection:
            selected_show = self.tracked_shows[selection[0]]
            self.update_episodes_tree(selected_show)

    def update_episodes_tree(self, show):
        for item in self.episodes_tree.get_children():
            self.episodes_tree.delete(item)
        
        for season in range(show['start_season'], show['end_season'] + 1):
            if show['names'][0] in self.known_shows:
                eps_per_season = self.get_episodes_per_season(show, season)
            else:
                eps_per_season = show['end_episode']

            start_ep = show['start_episode'] if season == show['start_season'] else 1
            end_ep = show['end_episode'] if season == show['end_season'] else eps_per_season

            for ep in range(start_ep, end_ep + 1):
                if show['downloaded_episodes'].get(season) and ep in show['downloaded_episodes'][season]:
                    status = 'Downloaded'
                    tags = ('downloaded',)
                elif show['needed_episodes'].get(season) and ep in show['needed_episodes'][season]:
                    status = 'Needed'
                    tags = ('needed',)
                else:
                    continue

                self.episodes_tree.insert('', 'end', values=(f"S{season:02d}", f"E{ep:02d}", status), tags=tags)

    def get_episodes_per_season(self, show, season):
        primary_name = show['names'][0]
        if primary_name in self.known_shows:
            eps_data = self.known_shows[primary_name].get('episodes_per_season', 12)
            if isinstance(eps_data, list):
                return eps_data[season - 1] if (season - 1) < len(eps_data) else 12
            else:
                return eps_data
        else:
            return show['end_episode']

    def log(self, message: str, level: str = "info"):
        """High-level logging to the GUI log."""
        self.log_text.config(state=tk.NORMAL)
        tag = level if level in ["info", "success", "error", "separator"] else "info"
        self.log_text.insert(tk.END, f"{message}\n", tag)
        if level == "separator":
            self.log_text.insert(tk.END, "---" * 20 + "\n", "separator")
        self.log_text.see(tk.END)
        self.log_text.config(state=tk.DISABLED)
        self.root.update_idletasks()

    def add_show(self):
        dialog = AddShowDialog(self.root)
        self.root.wait_window(dialog)
        if dialog.result:
            new_show = {
                **dialog.result,
                'downloaded_episodes': {},
                'needed_episodes': {},
                'last_checked': None
            }
            self.tracked_shows.append(new_show)
            self.recalculate_needed_for_show(new_show)
            self.update_show_list()
            self.save_state()
            self.log(f"Added new show: {new_show['names'][0]}", level="info")

    def remove_show(self):
        selection = self.listbox.curselection()
        if selection:
            show = self.tracked_shows.pop(selection[0])
            self.update_show_list()
            self.save_state()
            self.log(f"Removed show: {show['names'][0]}", level="info")
            self.episodes_tree.delete(*self.episodes_tree.get_children())

    def update_show_list(self):
        self.listbox.delete(0, tk.END)
        for show in self.tracked_shows:
            primary_name = show['names'][0]
            text = f"{primary_name} - S{show['start_season']}E{show['start_episode']}→S{show['end_season']}E{show['end_episode']} ({show['quality']})"
            self.listbox.insert(tk.END, text)

    def toggle_scan(self):
        if not self.scanning:
            self.start_scan()
        else:
            self.stop_scan()

    def start_scan(self):
        if not self.scanning:
            self.scanning = True
            self.btn_scan.config(text="Stop Search")
            self.stop_scan_event.clear()
            threading.Thread(target=self.scan_shows_threaded, daemon=True).start()
            self.log("Started scanning shows.", level="info")

    def stop_scan(self):
        if self.scanning:
            self.stop_scan_event.set()
            self.log("Stopping scan...", level="info")
            self.btn_scan.config(state=tk.DISABLED)

    def scan_shows_threaded(self):
        try:
            self.scan_shows()
        finally:
            self.root.after(0, self.on_scan_complete)

    def on_scan_complete(self):
        self.scanning = False
        self.btn_scan.config(text="Scan Now", state=tk.NORMAL)
        if self.stop_scan_event.is_set():
            self.status_var.set("Scan stopped")
            self.log("Scan was stopped by user.", level="info")
        else:
            self.status_var.set("Scan complete")
            self.log("Scan completed successfully.", level="info")

    def scan_shows(self):
        for show in self.tracked_shows:
            if self.stop_scan_event.is_set():
                self.log("Scan stopped by user.", level="info")
                break

            self.log(f"=== Scanning Show: {show['names'][0]} ===", level="info")
            self.status_var.set(f"Scanning {show['names'][0]}...")
            self.root.update_idletasks()

            # Sort needed episodes (as tuples of (season, episode))
            needed_sorted = sorted(
                [(season, ep) for season, episodes in show['needed_episodes'].items() for ep in episodes],
                key=lambda x: (x[0], x[1])
            )

            # Iterate over needed episodes in order.
            for season, episode in needed_sorted:
                if self.stop_scan_event.is_set():
                    self.log("Scan stopped by user.", level="info")
                    return

                self.log(f"  Checking Episode: S{season:02d}E{episode:02d}", level="info")
                found = self.search_episode(show, season, episode)
                if found:
                    show['needed_episodes'][season].remove(episode)
                    if not show['needed_episodes'][season]:
                        del show['needed_episodes'][season]
                    show['downloaded_episodes'].setdefault(season, set()).add(episode)
                    self.save_state()
                else:
                    self.log(f"  Episode not found for {show['names'][0]} at S{season:02d}E{episode:02d}", level="info")
                    # Assume later episodes are not out yet.
                    break

            show['last_checked'] = current_timestamp()
            self.save_state()

    def search_episode(self, show: Dict, season: int, episode: int) -> bool:
        if self.stop_scan_event.is_set():
            return False

        queries = []
        for name in show['names']:
            queries.extend([
                f"{name} S{season:02d}E{episode:02d} {show['quality']}",
                f"{name} S{season} - {episode:02d} {show['quality']}"
            ])

        for query in queries:
            if self.stop_scan_event.is_set():
                self.log("Scan stopped by user during search.", level="info")
                return False

            self.log(f"   Trying search query: {query}", level="info")
            params = {
                'f': 0,
                'c': '0_0',
                'q': query,
                's': 'seeders',
                'o': 'desc'
            }

            try:
                response = requests.get(self.config['nyaa_url'], params=params, timeout=10)
                soup = BeautifulSoup(response.text, 'html.parser')

                for row in soup.select('tr.danger, tr.default, tr.success'):
                    if self.stop_scan_event.is_set():
                        self.log("Scan stopped by user during torrent processing.", level="info")
                        return False

                    title_anchor = row.select_one('a[href^="/view/"]:not(.comments)')
                    if not title_anchor:
                        continue

                    title = title_anchor.text.strip()
                    magnet_tag = row.select_one('a[href^="magnet:"]')
                    if not magnet_tag:
                        continue
                    magnet = magnet_tag['href']

                    try:
                        # Debug info printed to console (not in GUI log)
                        debug_log(f"Parsing title: {title}")
                        parsed = self.parse_title(title)
                        debug_log(f"Parsed title: {parsed}")
                        
                        if self.is_valid_episode(show, season, episode, parsed):
                            self.log(f"    Match Found: {title}", level="success")
                            webbrowser.open(magnet)

                            if parsed.get('is_batch'):
                                batch_episodes = self.get_batch_episodes(parsed)
                                for be_season, be_episode in batch_episodes:
                                    if show['needed_episodes'].get(be_season) and be_episode in show['needed_episodes'][be_season]:
                                        show['downloaded_episodes'].setdefault(be_season, set()).add(be_episode)
                                        show['needed_episodes'][be_season].discard(be_episode)
                                        if not show['needed_episodes'][be_season]:
                                            show['needed_episodes'].pop(be_season, None)
                                self.log(f"     Batch Episodes Downloaded: {batch_episodes}", level="success")
                            else:
                                show['downloaded_episodes'].setdefault(season, set()).add(episode)
                            self.save_state()
                            return True

                    except Exception as e:
                        debug_log(f"Error processing torrent for title '{title}': {str(e)}")
                        continue

            except Exception as e:
                debug_log(f"Search query failed for query '{query}': {str(e)}")

        return False

    def calculate_absolute_episode(self, show_name: str, season: int, episode: int) -> int:
        eps_data = self.known_shows.get(show_name, {}).get('episodes_per_season', 12)
        if isinstance(eps_data, list):
            total = sum(eps_data[:season-1])
            return total + episode
        return (season - 1) * eps_data + episode

    def load_known_shows(self) -> Dict:
        try:
            with open(self.config['known_shows_file']) as f:
                return json.load(f)
        except FileNotFoundError:
            return {}
        except Exception as e:
            self.log(f"Error loading known shows: {str(e)}", "error")
            return {}

    def save_known_shows(self, updated_shows):
        self.known_shows = updated_shows
        try:
            with open(self.config['known_shows_file'], 'w') as f:
                json.dump(self.known_shows, f, indent=2)
            self.recalculate_needed_for_all_shows()
            messagebox.showinfo("Success", "Known shows updated successfully.")
        except Exception as e:
            messagebox.showerror("Error", f"Failed to save known shows: {str(e)}")

    def edit_known_shows_gui(self):
        dialog = EditKnownShowsDialog(self.root, self.known_shows, self.save_known_shows)
        self.root.wait_window(dialog)

    def load_state(self):
        try:
            if not os.path.exists('tracked_shows.json') or os.path.getsize('tracked_shows.json') == 0:
                self.tracked_shows = []
                self.log("No tracked shows found. Starting fresh.", "info")
                return

            with open('tracked_shows.json') as f:
                data = json.load(f)
                for show in data:
                    downloaded = {}
                    for season, episode in show.get('downloaded_episodes', []):
                        downloaded.setdefault(season, []).append(episode)
                    show['downloaded_episodes'] = {int(season): set(episodes) for season, episodes in downloaded.items()}

                    needed = {}
                    for season, episode in show.get('needed_episodes', []):
                        needed.setdefault(season, []).append(episode)
                    show['needed_episodes'] = {int(season): set(episodes) for season, episodes in needed.items()}

                    show.setdefault('last_checked', None)
                    show.setdefault('quality', '1080p')
                    show.setdefault('names', [])
                    show.setdefault('start_season', 1)
                    show.setdefault('start_episode', 1)
                    show.setdefault('end_season', 1)
                    show.setdefault('end_episode', 12)

                self.tracked_shows = data
                self.log("Loaded tracked shows successfully.", "info")
        except FileNotFoundError:
            self.tracked_shows = []
            self.log("No tracked shows file found. Starting fresh.", "info")
        except json.decoder.JSONDecodeError as e:
            self.tracked_shows = []
            self.log("Error loading state: Invalid JSON format. Starting fresh.", "error")
        except Exception as e:
            self.tracked_shows = []
            self.log(f"Error loading state: {str(e)}", "error")

    def save_state(self):
        data = []
        for show in self.tracked_shows:
            show_copy = show.copy()

            downloaded = []
            for season, episodes in show_copy.get('downloaded_episodes', {}).items():
                for episode in episodes:
                    downloaded.append([season, episode])
            show_copy['downloaded_episodes'] = sorted(downloaded, key=lambda x: (x[0], x[1]))

            needed = []
            for season, episodes in show_copy.get('needed_episodes', {}).items():
                for episode in episodes:
                    needed.append([season, episode])
            show_copy['needed_episodes'] = sorted(needed, key=lambda x: (x[0], x[1]))

            data.append(show_copy)

        try:
            with open('tracked_shows.json', 'w') as f:
                json.dump(data, f, indent=2)
            self.log("State saved successfully.", "info")
        except Exception as e:
            self.log(f"Error saving state: {str(e)}", "error")

    def recalculate_needed_for_all_shows(self):
        for show in self.tracked_shows:
            self.recalculate_needed_for_show(show)
        self.save_state()

    def recalculate_needed_for_show(self, show: Dict):
        try:
            needed = {}
            show_name = show['names'][0]
            start_season = show['start_season']
            end_season = show['end_season']
            start_episode = show['start_episode']
            end_episode = show['end_episode']

            for season in range(start_season, end_season + 1):
                if show_name in self.known_shows:
                    eps_data = self.known_shows[show_name].get('episodes_per_season', 12)
                    if isinstance(eps_data, list):
                        eps_per_season = eps_data[season - 1] if season - 1 < len(eps_data) else 12
                    else:
                        eps_per_season = eps_data

                    current_start_ep = start_episode if season == start_season else 1
                    current_end_ep = end_episode if season == end_season else eps_per_season
                    current_end_ep = min(current_end_ep, eps_per_season)
                else:
                    if start_season == end_season:
                        current_start_ep = start_episode
                        current_end_ep = end_episode
                    else:
                        if season == start_season:
                            current_start_ep = start_episode
                            current_end_ep = show['end_episode']
                        elif season == end_season:
                            current_start_ep = 1
                            current_end_ep = end_episode
                        else:
                            current_start_ep = 1
                            current_end_ep = show['end_episode']

                current_start_ep = max(1, current_start_ep)
                current_end_ep = max(current_start_ep, current_end_ep)

                for ep in range(current_start_ep, current_end_ep + 1):
                    if show['downloaded_episodes'].get(season) and ep in show['downloaded_episodes'][season]:
                        continue
                    needed.setdefault(season, set()).add(ep)

            show['needed_episodes'] = needed

        except Exception as e:
            self.log(f"Error recalculating episodes for {show['names'][0]}: {str(e)}", "error")

    def get_batch_episodes(self, parsed: Dict) -> Set[Tuple[int, int]]:
        season = parsed['season']
        show_name = parsed.get('show', "")
        eps_data = self.known_shows.get(show_name, {}).get('episodes_per_season', 12)
        if isinstance(eps_data, list):
            eps_per_season = eps_data[season-1] if season-1 < len(eps_data) else 12
        else:
            eps_per_season = eps_data
        return {(season, ep) for ep in range(1, eps_per_season + 1)}

    def is_valid_episode(self, show: Dict, target_season: int, target_episode: int, parsed: Dict) -> bool:
        norm_parsed = normalize_show_name(parsed.get('show', ""))
        if not any(normalize_show_name(name) == norm_parsed for name in show['names']):
            return False

        if parsed.get('quality') != show.get('quality'):
            return False

        if parsed.get('is_batch'):
            batch_episodes = self.get_batch_episodes(parsed)
            return (target_season, target_episode) in batch_episodes
        else:
            return parsed.get('season') == target_season and parsed.get('episode') == target_episode

    def parse_title(self, title: str) -> Dict:
        """
        Parse a torrent title using OpenAI's API.
        Under the hood debug logging is sent to the console.
        """
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        system_prompt = f"""Extract anime metadata as JSON with:
- show: normalized title
- season: number
- episode: number (null if batch)
- is_batch: boolean
- quality: string
- batch_episodes: array of episode numbers (if batch)
Rules for {json.dumps(self.known_shows, indent=2)}
If season markers are missing, derive season based on episode counts."""
        try:
            debug_log(f"Parsing title: {title}")
            response = client.chat.completions.create(
                model=self.config['openai_model'],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": title}
                ],
                temperature=0.1
            )
            raw_response = response.choices[0].message.content
            debug_log(f"Raw response for title '{title}': {raw_response}")
            # Remove markdown formatting if present
            if raw_response.startswith("```json"):
                raw_response = raw_response.split("```json", 1)[1]
                if "```" in raw_response:
                    raw_response = raw_response.split("```", 1)[0]
                raw_response = raw_response.strip()
            result = json.loads(raw_response)
            result['season'] = int(result.get('season', 1))
            if 'episode' in result and result['episode'] is not None:
                result['episode'] = int(result['episode'])
            return result
        except Exception as e:
            debug_log(f"Exception in parse_title for title '{title}': {str(e)}")
            raise

    def edit_show(self, event):
        selection = self.listbox.curselection()
        if selection:
            selected_index = selection[0]
            show_to_edit = self.tracked_shows[selected_index]
            dialog = EditShowDialog(self.root, show_to_edit)
            self.root.wait_window(dialog)
            if dialog.result:
                updated_show = {
                    **dialog.result,
                    'downloaded_episodes': show_to_edit['downloaded_episodes'],
                    'needed_episodes': show_to_edit['needed_episodes'],
                    'last_checked': show_to_edit['last_checked']
                }
                self.tracked_shows[selected_index] = updated_show
                self.recalculate_needed_for_show(updated_show)
                self.update_show_list()
                self.save_state()
                self.log(f"Edited show: {updated_show['names'][0]}", level="info")

    def reset_show(self):
        selection = self.listbox.curselection()
        if not selection:
            messagebox.showerror("Error", "No show selected to reset.")
            return

        selected_index = selection[0]
        show = self.tracked_shows[selected_index]
        show_name = show['names'][0]

        if messagebox.askyesno("Confirm Reset", f"Are you sure you want to reset all data for '{show_name}'?"):
            show['downloaded_episodes'].clear()
            self.recalculate_needed_for_show(show)
            self.update_episodes_tree(show)
            self.update_show_list()
            self.save_state()
            self.log(f"Show '{show_name}' has been reset.", level="info")

    def on_closing(self):
        if self.scanning:
            if messagebox.askokcancel("Quit", "A scan is in progress. Do you want to stop the scan and quit?"):
                self.stop_scan_event.set()
                self.root.destroy()
        else:
            self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = AnimeTrackerApp(root)
    root.mainloop()

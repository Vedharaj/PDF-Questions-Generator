from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)
from rich.theme import Theme


theme = Theme(
    {
        "progress.description": "bold cyan",
        "progress.percentage": "bold green",
        "progress.elapsed": "dim",
        "progress.remaining": "dim",
    }
)

console = Console(theme=theme)


def create_progress():
    return Progress(
        SpinnerColumn(style="cyan"),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=None, complete_style="cyan", finished_style="green"),
        TaskProgressColumn(),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(),
        console=console,
        transient=False,
        expand=True,
    )


def progress_iter(iterable, description, unit="item"):
    total = len(iterable) if hasattr(iterable, "__len__") else None

    with create_progress() as progress:
        task_id = progress.add_task(description, total=total, unit=unit)
        for item in iterable:
            yield item
            progress.advance(task_id)
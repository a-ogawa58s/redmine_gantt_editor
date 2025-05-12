(function($) {
  $.fn.ganttEditor = function(options) {
    var settings = $.extend({
      projectId: null,
      tasks: []
    }, options);

    var $container = this;
    var draggedTask = null;
    var dragOffset = 0;
    var zoomLevel = 0.5; // デフォルトのズームレベル
    var pixelsPerDay = 25; // デフォルトの1日あたりのピクセル数（50 * 0.5）
    var dragMode = null; // 'move', 'start', 'end'

    function init() {
      console.log('Initializing gantt editor with tasks:', settings.tasks);
      renderZoomControls();
      renderTasks();
      bindEvents();
    }

    function renderZoomControls() {
      var $zoomControls = $('<div>')
        .addClass('gantt-zoom-controls');

      var $zoomOut = $('<button>')
        .text('-')
        .addClass('zoom-button');

      var $zoomIn = $('<button>')
        .text('+')
        .addClass('zoom-button');

      var $zoomReset = $('<button>')
        .text('リセット')
        .addClass('zoom-button')
        .css({
          fontSize: '12px'
        });

      $zoomControls.append($zoomOut, $zoomIn, $zoomReset);
      //$container.prepend($zoomControls);
      $container.parent().find('#gantt-editor-title').append($zoomControls); // チャートの親要素に追加

      // ズームボタンのイベントハンドラ
      $zoomOut.on('click', function() {
        if (zoomLevel >= 0.5) {
          zoomLevel -= 0.25;
          pixelsPerDay = 50 * zoomLevel;
          $container.find('.gantt-scale-month, .gantt-scale-weekday, .gantt-scale-day, .gantt-task, .gantt-vertical-line').remove();
          renderTasks();
        }
      });

      $zoomIn.on('click', function() {
        if (zoomLevel <= 0.75) {
          zoomLevel += 0.25;
          pixelsPerDay = 50 * zoomLevel;
          $container.find('.gantt-scale-month, .gantt-scale-weekday, .gantt-scale-day, .gantt-task, .gantt-vertical-line').remove();
          renderTasks();
        }
      });

      $zoomReset.on('click', function() {
        zoomLevel = 0.5; // リセット時のズームレベル
        pixelsPerDay = 25; // リセット時のピクセル数も調整
        $container.find('.gantt-scale-month, .gantt-scale-weekday, .gantt-scale-day, .gantt-task, .gantt-vertical-line').remove();
        renderTasks();
      });
    }

    function renderTasks() {
      if (!settings.tasks || settings.tasks.length === 0) {
        console.log('No tasks to render');
        return;
      }

      // 日付の範囲を計算
      var firstDate = new Date(Math.min.apply(null, settings.tasks.map(function(t) {
        return new Date(t.start_date);
      })));
      var lastDate = new Date(Math.max.apply(null, settings.tasks.map(function(t) {
        return new Date(t.due_date);
      })));
      // 日付の範囲を計算（3ヶ月分＋月末）
      lastDate.setMonth(lastDate.getMonth() + 3);
      lastDate.setDate(-1);

      // タスクを表示
      settings.tasks.forEach(function(task, index) {
        console.log('タスクを表示:', task);
        var $task = $('<div>')
          .addClass('gantt-task')
          .attr('data-task-id', task.id)
          .attr('draggable', 'true')
          .attr('title', '件名: ' + task.subject + '\n' +
                        '開始日: ' + task.start_date + '\n' +
                        '期日: ' + (task.due_date === null ? '未設定' : task.due_date) + '\n' +
                        'ステータス: ' + task.status_name + '\n' +
                        '進捗率: ' + (task.done_ratio || 0) + '%')
          .html('<span class="task-subject">' + task.subject + '</span>')
          .css({
            position: 'absolute',
            top: (index * 30 + 65) + 'px', // 35px = タスクの高さ(25px) + 余白(10px)
            left: calculateLeftPosition(task.start_date, firstDate),
            width: calculateWidth(task.start_date, task.due_date),
            height: '20px', // 高さを30pxから25pxに変更
            backgroundColor: getTaskColor(task),
            color: 'white',
            padding: '1px 5px', // パディングを調整
            borderRadius: '3px',
            cursor: 'move',
            userSelect: 'none',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            transition: 'box-shadow 0.3s ease',
            fontSize: '12px', // フォントサイズを調整
            lineHeight: '19px' // 行の高さを調整
          });

        // リサイズハンドルを追加
        var $startHandle = $('<div>')
          .addClass('gantt-task-handle start-handle')
          .css({
            position: 'absolute',
            left: '0',
            top: '0',
            width: '10px',
            height: '100%',
            cursor: 'ew-resize',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderTopLeftRadius: '3px',
            borderBottomLeftRadius: '3px'
          });

        var $endHandle = $('<div>')
          .addClass('gantt-task-handle end-handle')
          .css({
            position: 'absolute',
            right: '0',
            top: '0',
            width: '10px',
            height: '100%',
            cursor: 'ew-resize',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderTopRightRadius: '3px',
            borderBottomRightRadius: '3px'
          });

        $task.append($startHandle, $endHandle);
        $container.prepend($task);
      });

      // 日付目盛りを表示
      renderDateScale(firstDate, lastDate);

      // チケット一覧を表示
      renderTicketList();
    }

    function renderTicketList() {
      // チケット一覧のコンテナを作成
      var $ticketList = $('<div>')
        .addClass('gantt-ticket-list')
        .css({
          position: 'absolute',
          paddingTop: '60px',
          left: '0',
          top: '0px',
          width: '200px',
          height: '100%',
          backgroundColor: '#f5f5f5',
          boxSizing: 'border-box',
          borderRight: '1px solid #ccc',
          zIndex: '999',
          overflowY: 'auto'
        });

      // チケットを親子関係でソート
      var sortedTasks = sortTasksByParent(settings.tasks);

      // チケット一覧を表示
      sortedTasks.forEach(function(task, index) {
        var indent = task.parent_id ? 20 : 0; // 子チケットは20pxインデント
        var $ticket = $('<div>')
          .addClass('gantt-ticket-item')
          .attr('data-task-id', task.id)
          .css({
            padding: '5px 10px',
            paddingLeft: (10 + indent) + 'px',
            boxSizing: 'border-box',
            borderBottom: '1px solid #ddd',
            fontSize: '12px',
            lineHeight: '20px',
            cursor: 'pointer',
            backgroundColor: task.parent_id ? '#fafafa' : '#f5f5f5'
          })
          .html(task.subject);

        // クリックイベントを追加
        $ticket.on('click', function() {
          window.open('/issues/' + task.id, 'open_ticket');
        });

        $ticketList.append($ticket);
      });

      $container.prepend($ticketList);

      // ガントチャートの位置を調整
      //$container.css({
      //  paddingLeft: '200px' // チケット一覧の幅分だけ右にずらす
      //});
    }

    function sortTasksByParent(tasks) {
      // 親チケットを取得
      var parentTasks = tasks.filter(function(task) {
        return !task.parent_id;
      });

      // 子チケットを取得
      var childTasks = tasks.filter(function(task) {
        return task.parent_id;
      });

      // 親チケットの下に子チケットを配置
      var sortedTasks = [];
      parentTasks.forEach(function(parentTask) {
        sortedTasks.push(parentTask);
        // この親の子チケットを追加
        childTasks.forEach(function(childTask) {
          if (childTask.parent_id === parentTask.id) {
            sortedTasks.push(childTask);
          }
        });
      });

      // 親のない子チケットを追加
      childTasks.forEach(function(childTask) {
        if (!tasks.find(function(t) { return t.id === childTask.parent_id; })) {
          sortedTasks.push(childTask);
        }
      });

      return sortedTasks;
    }

    function renderDateScale(firstDate, lastDate) {
      // 月の目盛り
      var $monthScale = $('<div>')
        .addClass('gantt-scale-month');

      // 曜日の目盛り
      var $weekdayScale = $('<div>')
        .addClass('gantt-scale-weekday');

      // 日の目盛り
      var $dayScale = $('<div>')
        .addClass('gantt-scale-day');

      // 縦の罫線
      var $verticalLineScale = $('<div>')
        .addClass('gantt-scale-vertical-line');

      // 月の表示
      var currentDate = new Date(firstDate);
      currentDate.setDate(1); // 月の初日に設定
      
      while (currentDate <= lastDate) {
        var monthStart = new Date(currentDate);
        var monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // 月の最終日に設定
        
        // 月の開始位置を計算（月初日の0時0分0秒）
        var monthLeft = calculateLeftPosition(monthStart, firstDate);
        
        // 次の月の開始位置を計算
        var nextMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        var nextMonthLeft = calculateLeftPosition(nextMonthStart, firstDate);
        
        // 月の幅を計算（次の月の開始位置 - 現在の月の開始位置）
        var monthWidth = nextMonthLeft - monthLeft;
        
        var $monthLabel = $('<div>')
          .addClass('gantt-scale-month-label')
          .text(formatMonthYear(currentDate.getMonth(), currentDate.getFullYear()))
          .css({
            position: 'absolute',
            top: '0px',
            height: '20px',
            left: monthLeft + 'px',
            width: monthWidth + 'px',
            textAlign: 'center',
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            backgroundColor: '#e0e0e0',
            fontSize: Math.max(12, 12 * zoomLevel) + 'px',
            fontWeight: 'bold',
            color: '#333',
          });
        $monthScale.append($monthLabel);
        
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // 曜日と日の表示
      currentDate = new Date(firstDate);
      while (currentDate <= lastDate) {
        var dayOfWeek = currentDate.getDay();
        var isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0: 日曜日, 6: 土曜日
        var weekendBgColor = dayOfWeek === 0 ? 'rgba(250, 200, 200)' : 'rgba(215, 215, 250)'; // 日曜: 薄い赤, 土曜: 薄い青

        // 曜日の表示
        var $weekday = $('<div>')
          .addClass('gantt-scale-weekday-label')
          .text(formatWeekday(dayOfWeek))
          .css({
            position: 'absolute',
            top: '0px',
            height: '20px',
            left: calculateLeftPosition(currentDate, firstDate),
            width: pixelsPerDay + 'px',
            textAlign: 'center',
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            backgroundColor: isWeekend ? weekendBgColor : '#f0f0f0',
            fontSize: Math.max(12, 12 * zoomLevel) + 'px',
            color: getWeekdayColor(dayOfWeek)
          });
        $weekdayScale.append($weekday);

        // 日の表示
        var $day = $('<div>')
          .addClass('gantt-scale-day-label')
          .text(currentDate.getDate())
          .css({
            position: 'absolute',
            top: '0px',
            height: '20px',
            left: calculateLeftPosition(currentDate, firstDate),
            width: pixelsPerDay + 'px',
            textAlign: 'center',
            paddingTop: '3px',
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            borderBottom: '1px solid #ccc',
            backgroundColor: isWeekend ? weekendBgColor : '#f5f5f5',
            fontSize: Math.max(12, 12 * zoomLevel) + 'px',
            color: '#666'
          });
        $dayScale.append($day);

        // 縦の罫線を追加
        var $verticalLine = $('<div>')
          .addClass('gantt-vertical-line')
          .css({
            position: 'absolute',
            top: '0px',
            height: '100%',
            left: calculateLeftPosition(currentDate, firstDate),
            width: pixelsPerDay + 'px',
            boxSizing: 'border-box',
            borderRight: '1px solid #ccc',
            backgroundColor: isWeekend ? weekendBgColor : '#ffffff',
          });
        //$container.append($verticalLine);
        $verticalLineScale.append($verticalLine);

        currentDate.setDate(currentDate.getDate() + 1);
      }

      $container.prepend($dayScale);
      $container.prepend($weekdayScale);
      $container.prepend($monthScale);
      $container.prepend($verticalLineScale);
    }

    function formatMonthYear(month, year) {
      var months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      //return months[month] + ' ' + year;
      return year + '年' + months[month];
    }

    function formatWeekday(day) {
      var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
      return weekdays[day];
    }

    function getWeekdayColor(day) {
      var colors = {
        0: '#ff0000', // 日曜日
        6: '#0000ff'  // 土曜日
      };
      return colors[day] || '#666';
    }

    function getTaskColor(task) {
      // 進捗率が100%の場合はグレーで表示
      if (task.done_ratio === 100) {
        return '#808080'; // グレー
      }

      var colors = {
        'Bug': '#ff0000',
        'Feature': '#4CAF50',
        'Support': '#2196F3'
      };
      return colors[task.tracker_name] || '#4CAF50';
    }

    function bindEvents() {
      var initialX = 0;
      var initialStartDate = null;
      var initialDueDate = null;

      // タスクの移動
      $container.on('dragstart', '.gantt-task', function(e) {
        if ($(e.target).hasClass('gantt-task-handle')) {
          e.preventDefault();
          return;
        }
        var taskId = $(this).data('task-id');
        draggedTask = settings.tasks.find(function(t) { return t.id === taskId; });
        
        // 初期位置と日付を保存
        initialX = e.clientX;
        initialStartDate = new Date(draggedTask.start_date);
        initialDueDate = new Date(draggedTask.due_date);
        initialDueDate = new Date(draggedTask.due_date === null ? draggedTask.start_date : draggedTask.due_date);

        dragMode = 'move';
        $(this).addClass('dragging');
      });

      // チケットのダブルクリック
      $container.on('dblclick', '.gantt-task', function(e) {
        if ($(e.target).hasClass('gantt-task-handle')) {
          return;
        }
        var taskId = $(this).data('task-id');
        var task = settings.tasks.find(function(t) { return t.id === taskId; });
        if (task) {
          //window.location.href = '/issues/' + taskId;
          window.open('/issues/' + taskId, 'open_ticket');
        }
      });

      // リサイズハンドルのイベント
      $container.on('mousedown', '.gantt-task-handle', function(e) {
        e.preventDefault();
        var $task = $(this).closest('.gantt-task');
        var taskId = $task.data('task-id');
        draggedTask = settings.tasks.find(function(t) { return t.id === taskId; });
        
        // 初期位置と日付を保存
        initialX = e.clientX;
        initialStartDate = new Date(draggedTask.start_date);
        initialDueDate = new Date(draggedTask.due_date === null ? draggedTask.start_date : draggedTask.due_date);
        
        dragMode = $(this).hasClass('start-handle') ? 'start' : 'end';
        $task.addClass('dragging');
      });

      $container.on('mouseup', '.gantt-task', function() {
        $(this).removeClass('dragging');
      });

      $container.on('dragover', function(e) {
        e.preventDefault();
      });

      $container.on('drop', function(e) {
        e.preventDefault();
        if (!draggedTask) return;

        // ドラッグ開始位置からの相対的な移動量を計算
        var deltaX = e.clientX - initialX;
        var daysToAdd = Math.round(deltaX / pixelsPerDay);
        
        if (dragMode === 'move') {
          var newStartDate = new Date(initialStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysToAdd);
          var duration = (initialDueDate - initialStartDate) / (1000 * 60 * 60 * 24);
          var newDueDate = new Date(newStartDate);
          newDueDate.setDate(newDueDate.getDate() + duration);
          updateTaskDates(draggedTask.id, newStartDate, newDueDate);
        }

        $container.find('.gantt-scale-month, .gantt-scale-weekday, .gantt-scale-day, .gantt-task').remove();
        renderTasks();
        draggedTask = null;
        dragMode = null;
      });

      // リサイズの処理
      var lastValidPosition = null;
      $(document).on('mousemove', function(e) {
        if (!draggedTask || !dragMode) return;

        // ドラッグ開始位置からの相対的な移動量を計算
        var deltaX = e.clientX - initialX;
        var daysToAdd = Math.round(deltaX / pixelsPerDay);
        
        if (dragMode === 'start') {
          var newStartDate = new Date(initialStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysToAdd);
          if (newStartDate < initialDueDate) {
            lastValidPosition = { startDate: newStartDate, dueDate: null };
            // 一時的なUI更新のみ
            var $task = $('.gantt-task[data-task-id="' + draggedTask.id + '"]');
            $task.css('left', calculateLeftPosition(newStartDate, new Date(settings.tasks[0].start_date)));
            $task.css('width', calculateWidth(newStartDate, initialDueDate));
          }
        } else if (dragMode === 'end') {
          var newDueDate = new Date(initialDueDate);
          newDueDate.setDate(newDueDate.getDate() + daysToAdd);
          if (newDueDate > initialStartDate) {
            lastValidPosition = { startDate: null, dueDate: newDueDate };
            // 一時的なUI更新のみ
            var $task = $('.gantt-task[data-task-id="' + draggedTask.id + '"]');
            $task.css('width', calculateWidth(initialStartDate, newDueDate));
          }
        } else if (dragMode === 'move') {
          var newStartDate = new Date(initialStartDate);
          newStartDate.setDate(newStartDate.getDate() + daysToAdd);
          var duration = (initialDueDate - initialStartDate) / (1000 * 60 * 60 * 24);
          var newDueDate = new Date(newStartDate);
          newDueDate.setDate(newDueDate.getDate() + duration);
          
          // 一時的なUI更新のみ
          var $task = $('.gantt-task[data-task-id="' + draggedTask.id + '"]');
          $task.css('left', calculateLeftPosition(newStartDate, new Date(settings.tasks[0].start_date)));
          $task.css('width', calculateWidth(newStartDate, newDueDate));
          
          lastValidPosition = { startDate: newStartDate, dueDate: newDueDate };
        }
      });

      $(document).on('mouseup', function() {
        if (draggedTask && lastValidPosition) {
          // ハンドル操作完了時に日付を更新
          updateTaskDates(
            draggedTask.id,
            lastValidPosition.startDate,
            lastValidPosition.dueDate
          );
          lastValidPosition = null;
        }
        if (draggedTask) {
          draggedTask = null;
          dragMode = null;
          $('.gantt-task').removeClass('dragging');
        }
      });
    }

    function calculateLeftPosition(date, firstDate) {
      var days = Math.round((new Date(date) - new Date(firstDate)) / (1000 * 60 * 60 * 24));
      return Math.max(0, days * pixelsPerDay) + 200;
    }

    function calculateWidth(startDate, dueDate) {
      dueDate = dueDate === null ? startDate : dueDate;
      var days = Math.round((new Date(dueDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
      return Math.max(0, (days + 1) * pixelsPerDay - 10); // 右ハンドルの位置を調整
    }

    function updateTaskDates(taskId, startDate, dueDate) {
      console.log('Updating task dates:', {
        taskId: taskId,
        startDate: startDate,
        dueDate: dueDate
      });

      // 日付のフォーマット
      var formatDate = function(date) {
        if (!date) return null;
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      // リクエストデータの準備
      var data = {
        issue_id: taskId
      };

      // 開始日と期日の更新
      if (startDate) {
        data.start_date = formatDate(startDate);
      }
      if (dueDate) {
        data.due_date = formatDate(dueDate);
      }

      console.log('Request data:', data);

      // 更新前の状態を保存
      var originalTask = settings.tasks.find(function(t) { return t.id === taskId; });
      var originalStartDate = originalTask.start_date;
      var originalDueDate = originalTask.due_date;

      // 一時的にUIを更新
      if (startDate) {
        originalTask.start_date = formatDate(startDate);
      }
      if (dueDate) {
        originalTask.due_date = formatDate(dueDate);
      }
      renderTasks();

      // サーバーに更新を送信
      $.ajax({
        url: '/projects/' + settings.projectId + '/gantt_editor/update_dates',
        method: 'POST',
        data: data,
        headers: {
          'X-CSRF-Token': $('meta[name="csrf-token"]').attr('content')
        },
        success: function(response) {
          console.log('Server response:', response);
          if (response.success) {
            console.log('日付の更新に成功しました');
          } else {
            // エラー時は元の状態に戻す
            originalTask.start_date = originalStartDate;
            originalTask.due_date = originalDueDate;
            renderTasks();
            alert('日付の更新に失敗しました: ' + (response.errors ? response.errors.join(', ') : '不明なエラー'));
          }
        },
        error: function(xhr, status, error) {
          console.error('Ajax error:', {
            status: status,
            error: error,
            response: xhr.responseText
          });

          // エラー時は元の状態に戻す
          originalTask.start_date = originalStartDate;
          originalTask.due_date = originalDueDate;
          renderTasks();
          
          var errorMessage = '日付の更新に失敗しました';
          try {
            var response = JSON.parse(xhr.responseText);
            if (response.errors) {
              errorMessage += ': ' + response.errors.join(', ');
            }
          } catch (e) {
            console.error('Error parsing response:', e);
          }
          alert(errorMessage);
        }
      });
    }

    init();
    return this;
  };
})(jQuery); 